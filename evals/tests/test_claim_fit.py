"""Which form carries which claim: one definition, read by everything that chooses a form.

Three decks written from one brief each set about two thirds of their exhibits
as a table, a bar chart and a line chart. Their forms were not wrong - nearly
every one was a best fit for its claim - but wherever two forms fitted equally
the same one was taken, by the author and by `--plan` alike, and eleven forms
could not be written from measures at all, so they were not reached for. The
choice lived in prose. It is now data (runtime/claim-fit.mjs): a reading task
read off the measures a page shows, and every form graded against it. These
hold that definition, that every catalogue form is in it, that a scaffold reads
it and binds every form that plots measures, and that the standings say what
it finds without refusing anything.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, SKILL, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
FIXTURE = ROOT / "evals" / "quality" / "fixtures" / "variety"
KIT = "./skills/professional-slides/runtime"
# The fixture's insight log and spine, and each page's fit: what the probes below read.
LOAD = f"""
import fs from 'node:fs';
import {{ pageFit, carriersFor, profileOf, taskOf, CARRIERS, READING_TASKS, GRADE, fitCoverage, typeFitNote }} from '{KIT}/claim-fit.mjs';
import {{ measureRegistry }} from '{KIT}/measures.mjs';
import {{ PAGE_TYPES }} from '{KIT}/page-types.mjs';
const dir = './evals/quality/fixtures/variety';
const doc = JSON.parse(fs.readFileSync(dir + '/variety.pages.json', 'utf8'));
const log = JSON.parse(fs.readFileSync(dir + '/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const registry = measureRegistry(insights);
const page = (id) => doc.pages.find((p) => p.id === id);
const fit = (p) => pageFit(p, {{ registry, insights }});
const best = (p) => {{ const f = fit(p); return f?.task ? {{ task: f.task, best: f.forms.equal.map((x) => x.form).sort(), serves: f.forms.ranked.filter((x) => x.grade < f.forms.top).map((x) => x.form).sort(),
  lacking: Object.fromEntries(f.forms.lacking.map((x) => [x.form, x.lacks])), cuts: f.exhibits.map((e) => [e.task, e.kinds.equal.map((k) => k.kind.replace('chart.', '')).sort()]) }} : null; }};
"""


def cli(*args, cwd=None, timeout=300):
    return subprocess.run([NODE, str(AUTHOR), *map(str, args)], cwd=cwd or ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


class CatalogueTests(unittest.TestCase):
    def test_every_form_of_the_catalogue_is_in_the_fit_table_once_and_draws_the_kind_the_catalogue_says(self):
        result = run_node(LOAD + """
const forms = Object.entries(PAGE_TYPES).flatMap(([type, def]) => Object.keys(def.forms).map((form) => `${type}/${form}`));
const rows = CARRIERS.map((row) => `${row.type}/${row.form}`);
const coverage = fitCoverage();
console.log(JSON.stringify({ missing: forms.filter((f) => !rows.includes(f)), extra: rows.filter((r) => !forms.includes(r)), twice: rows.filter((r, i) => rows.indexOf(r) !== i),
  // A chart form's kind is the chart the catalogue draws for it.
  kinds: CARRIERS.filter((row) => String(PAGE_TYPES[row.type].forms[row.form]).startsWith('chart.') && row.kind && row.kind !== PAGE_TYPES[row.type].forms[row.form]).map((row) => `${row.type}/${row.form}`),
  // Every row either carries a task read from measures or says what its page has to show.
  silent: CARRIERS.filter((row) => !Object.keys(row.carries).length && !row.shows).map((row) => `${row.type}/${row.form}`),
  unknownTasks: CARRIERS.flatMap((row) => Object.keys(row.carries)).filter((task) => !READING_TASKS[task]),
  // Every reading task has a form that can be its best fit.
  uncarried: Object.entries(coverage.tasks).filter(([, forms]) => !forms.direct.length).map(([task]) => task), tasks: Object.keys(READING_TASKS).length }));
""")
        for key in ("missing", "extra", "twice", "kinds", "silent", "unknownTasks", "uncarried"):
            self.assertEqual(result[key], [], key)
        self.assertGreaterEqual(result["tasks"], 20)

    def test_the_catalogue_prints_the_table_by_reading_task_and_what_each_judged_form_is_for(self):
        types = cli("--types").stdout
        self.assertIn("## Which form carries which claim", types)
        # Every reading task is a line, with the forms that are its best fit.
        self.assertIn("- two values in one unit for each member - before and after, or one measure against another: best fit ", types)
        self.assertRegex(types, r"- which of five or more series moved over the same periods: best fit trend/line, trend/sparklines")
        self.assertRegex(types, r"- how far each member's own values run[^\n]*: best fit ranking/boxplot\n")
        # A form that at most serves a task is not listed as its best fit.
        line = next(text for text in types.splitlines() if text.startswith("- where each member of a set stands on one measure"))
        self.assertIn("serves scorecard/bars, lookup/table", line)
        self.assertNotIn("lookup/table", line.split("; serves")[0])
        # The forms no measure decides say what the page has to show.
        self.assertIn("- right for: harvey - members rated against criteria on a declared scale", types)
        self.assertIn("cycle - something that repeats", types)
        # And the design reference names the same section, where the choice is explained.
        design = (SKILL / "references" / "design.md").read_text(encoding="utf-8")
        self.assertIn("### Which form carries which claim", design)
        self.assertIn("runtime/claim-fit.mjs", design)


class ReadingTaskTests(unittest.TestCase):
    def test_the_task_is_read_from_what_the_page_shows_and_the_forms_are_graded_against_it(self):
        result = run_node(LOAD + """
console.log(JSON.stringify(Object.fromEntries(['v02', 'v03', 'v04', 'v07', 'v09', 'v11', 'v13', 'v14', 'v15', 'v17', 'v18', 'v20', 'v21', 'v22', 'v25', 'v30'].map((id) => [id, best(page(id))]))));
""")
        expect = {
            "v02": ("trend", ["area", "column", "line"]),               # one series of a quantity over eight years
            "v03": ("many-series", ["line", "sparklines"]),             # six series: one scale still holds them
            "v04": ("pair", ["dumbbell"]),                              # two dates for ten members
            "v07": ("contribution", ["waterfall"]),
            "v09": ("rank", ["bar", "lollipop"]),                       # ten members: past what columns name
            "v11": ("distribution", ["distribution"]),                  # a field of twenty
            "v13": ("spread", ["boxplot"]),
            "v14": ("relationship", ["scatter"]),
            "v15": ("profile", ["bars", "heatmap"]),
            "v17": ("two-scales", ["combo"]),
            "v18": ("part-of-whole", ["donut", "pie"]),                 # four parts
            "v20": ("mix-compared", ["marimekko", "stacked-bar", "stacked-column"]),
            "v21": ("figures", ["fact-grid", "stat-list"]),
            "v22": ("part-of-whole", ["treemap", "waffle"]),            # seven parts, whole counts
            "v25": ("target", ["bar", "bullet", "column"]),
            "v30": ("lookup", ["table"]),                               # one unit: nothing to group under units
        }
        for page_id, (task, forms) in expect.items():
            with self.subTest(page=page_id):
                self.assertEqual([result[page_id]["task"], result[page_id]["best"]], [task, forms])
        # A form that would carry the claim and that the measures do not fill says what it lacks, and is not offered.
        self.assertEqual(result["v18"]["lacking"], {"waffle": "a hundred units a part at most"})
        self.assertEqual(result["v22"]["lacking"]["donut"], "five parts at most")
        self.assertEqual(result["v04"]["serves"], ["aligned-bars", "bar", "column"])

    def test_a_page_whose_form_leaves_the_kind_open_is_read_a_cut_at_a_time(self):
        result = run_node(LOAD + """
console.log(JSON.stringify(Object.fromEntries(['v05', 'v10', 'v19', 'v24', 'v26', 'v29'].map((id) => [id, best(page(id))]))));
""")
        # Three measures in three units are three rankings; a figure over its series a trend; a claimed standard is read with its cut.
        self.assertEqual(result["v10"]["cuts"], [["rank", ["bar", "column", "lollipop"]]] * 3)
        self.assertEqual(result["v05"]["cuts"], [["trend", ["area", "column", "line"]]])
        self.assertEqual(result["v26"]["cuts"], [["target", ["bar", "bullet", "column"]]])
        self.assertEqual(result["v24"]["cuts"], [["rank", ["bar", "lollipop"]], ["part-of-whole", ["bar", "donut", "pie"]]])
        self.assertEqual(result["v29"]["cuts"][1], ["part-of-whole", ["bar", "treemap", "waffle"]])
        # A series that barely moves is a line: a mark standing on zero would show eight columns of one height.
        self.assertEqual(result["v19"]["cuts"], [["trend", ["area", "column", "line"]], ["trend", ["line"]]])
        # One figure over the exhibit that produced it: a strip carries it as directly as a hero number.
        self.assertEqual(result["v05"]["best"], ["hero-number", "metric-strip"])

    def test_the_claims_relation_changes_the_task_and_never_the_grade_of_a_form_for_variety(self):
        result = run_node(LOAD + """
const six = page('v03');
const levels = best({ ...six, settles: { ...six.settles, relation: { kind: 'levels' } } });
// The parts of a whole the claim ranks are members of a set, read against each other.
const ranked = best({ ...page('v18'), type: 'ranking', settles: { ...page('v18').settles, kind: 'rank' } });
const shared = best({ ...page('v18'), type: 'ranking' });
// A page with no recorded measure has no fit to read: nothing is proposed or questioned.
const none = fit({ id: 'x', type: 'trend', settles: { kind: 'rate', what: 'w', measures: ['i-nothing/there'] }, evidence: [] });
const judged = fit({ ...page('v15'), form: 'harvey' });
console.log(JSON.stringify({ levels, ranked, shared, none, judgedLeft: judged.left, judgedChosen: judged.chosen }));
""")
        # Six series whose levels the claim compares are read on one scale: small multiples lose it.
        self.assertEqual([result["levels"]["task"], result["levels"]["best"]], ["trend", ["line"]])
        self.assertEqual(result["ranked"]["task"], "rank")
        self.assertEqual(result["shared"]["task"], "part-of-whole")
        self.assertIsNone(result["none"])
        # A form whose cells are a judgement is the author's: recorded measures beside it never question it.
        self.assertEqual([result["judgedLeft"], result["judgedChosen"]], [[], None])

    def test_forms_graded_equal_are_equal_for_the_page_in_hand_and_not_only_for_its_measures_in_general(self):
        # A growth of one part between two dates graded a stacked column, a stacked bar and a marimekko alike, and a gap over
        # eight years a line and paired columns alike: where the plan's draw then chose among them, it could choose the worse.
        result = run_node(LOAD + """
const mix = (evidence, names, more = {}) => ({ id: 'q', type: 'composition', evidence: [evidence], settles: { kind: 'share', what: 'w', measures: names.map((name) => `${evidence}/${name}`) }, ...more });
const dayparts = ['peak', 'off-peak', 'weekend'];
const twoDates = mix('i-daypart', dayparts, { exhibit: { series: dayparts.map((name) => ({ measure: `i-daypart/${name}` })), select: { periods: ['FY19', 'FY26'] } } });
// Five operators whose totals run from 33 to 57: widths worth drawing. The same five made the same size: widths that say nothing.
const level = new Map(insights); const peers = structuredClone(insights.get('i-daypart-peers'));
peers.id = 'i-level'; peers.measures.peak.values = [10, 12, 14, 16, 18]; peers.measures['off-peak'].values = [20, 18, 16, 14, 12]; peers.measures.weekend.values = [10, 10, 10, 10, 10]; level.set('i-level', peers);
const grades = (p, log = insights) => { const f = pageFit(p, { registry: measureRegistry(log), insights: log }); return { task: f.task, best: f.forms.equal.map((x) => x.form).sort(), serves: f.forms.ranked.filter((x) => x.grade < f.forms.top).map((x) => x.form).sort() }; };
const gap = (select) => ({ id: 'g', type: 'trend', evidence: ['i-operators'], settles: { kind: 'rate', what: 'w', measures: ['i-operators/northvale', 'i-operators/coast'], relation: { kind: 'gap' } },
  ...(select ? { exhibit: { series: [{ measure: 'i-operators/northvale' }, { measure: 'i-operators/coast' }], select } } : {}) });
const parts = (ex, kind) => taskOf(profileOf(dayparts.map((name) => `i-daypart/${name}`), { registry, insights, evidence: ['i-daypart'], ex }), { kind });
console.log(JSON.stringify({ twoDates: grades(twoDates), members: grades(mix('i-daypart-peers', dayparts)), level: grades(mix('i-level', dayparts), level),
  gapLong: grades(gap(null)), gapShort: grades(gap({ from: 'FY22' })),
  tasks: [parts({ select: { periods: ['FY19', 'FY26'] } }, 'share'), parts({ select: { periods: ['FY19', 'FY26'] } }, 'rate'), parts(null, 'share'), parts(null, 'rate')],
  coverage: fitCoverage().tasks['mix-compared'].direct }));
""")
        # The mix of one whole at two dates is a column a date: rows read against time, and widths of one whole twice say nothing.
        self.assertEqual([result["twoDates"]["task"], result["twoDates"]["best"], result["twoDates"]["serves"]], ["mix-compared", ["stacked-column"], ["marimekko", "stacked-bar"]])
        # Across members all three can carry it - a marimekko only where the wholes differ in size enough to see.
        self.assertEqual(result["members"]["best"], ["marimekko", "stacked-bar", "stacked-column"])
        self.assertEqual([result["level"]["best"], result["level"]["serves"]], [["stacked-bar", "stacked-column"], ["marimekko"]])
        self.assertEqual(result["coverage"], ["composition/stacked-bar", "composition/stacked-column", "composition/marimekko"])   # each still a best fit somewhere
        # A gap is the space between two lines; paired columns show it for a few dates and no more.
        self.assertEqual([result["gapLong"]["task"], result["gapLong"]["best"]], ["gap-over-time", ["line"]])
        self.assertIn("column", result["gapLong"]["serves"])
        self.assertEqual(result["gapShort"]["best"], ["column", "line"])
        # Parts over time are a mix, unless the claim is settled by a rate: then each part's movement is read - a pair at two dates, a trend over many.
        self.assertEqual(result["tasks"], ["mix-compared", "pair", "mix-over-time", "trend"])

    def test_a_form_that_only_serves_is_named_and_a_table_or_an_unranked_form_is_not(self):
        result = run_node(LOAD + """
const bar = (ref) => ({ type: 'chart.bar', series: [{ measure: ref }] });
// Two dates of ten members as paired bars: the gap is worked out by the reader, where a dumbbell draws it.
const pair = fit({ ...page('v04'), form: 'bar' });
// A flat series under a strip, as columns.
const flat = fit({ id: 'n1', type: 'numbers', form: 'metric-strip', evidence: ['i-money'], settles: { kind: 'rate', what: 'w', measures: ['i-money/punctuality'] }, exhibit: { type: 'chart.column', series: [{ measure: 'i-money/punctuality' }] } });
// A table among charts is chosen for exact values: no measure says whether they are looked up.
const table = fit({ ...page('v10'), form: 'row', exhibits: [bar('i-profile/punctuality'), bar('i-profile/cost'), { type: 'table', columns: ['Operator', 'Years'], rows: insights.get('i-profile').measures['fleet-age'].members.map((name) => [name, `{{i-profile/fleet-age@${name}}}`]), basis: { measures: ['i-profile/fleet-age'] } }] });
console.log(JSON.stringify({ pair: pair.left, flat: flat.left, table: table.left, tableGrades: table.exhibits.map((e) => e.grade) }));
""")
        self.assertEqual(result["pair"], [{"where": "form", "has": "bar", "grade": 1, "better": ["dumbbell"]}])
        self.assertEqual([(item["where"], item["has"], item["better"]) for item in result["flat"]], [("exhibit 1", "chart.column", ["chart.line"])])
        self.assertEqual(result["table"], [])
        self.assertEqual(result["tableGrades"], [2, 2, None])


class ScaffoldTests(unittest.TestCase):
    def stage(self, tmp):
        for name in ("variety.pages.json", "variety.insights.json"):
            shutil.copy(FIXTURE / name, Path(tmp) / name)
        return Path(tmp) / "variety.pages.json"

    def test_every_form_that_plots_measures_is_written_from_them_and_compiles(self):
        # Eleven forms took no measure - a scatter, a bubble, small multiples, a box plot, a treemap, a bullet, a slope, a bubble
        # grid and the scorecards of recorded magnitudes - so a deck written by reference could not reach them.
        result = run_node(f"""
import fs from 'node:fs';
import {{ scaffoldReport, compileDeck }} from '{KIT}/author-deck.mjs';
import {{ CARRIERS }} from '{KIT}/claim-fit.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const CASES = {{ 'trend/line': 'i-journeys', 'trend/column': 'i-journeys', 'trend/area': 'i-journeys', 'trend/stacked-column': 'i-daypart', 'trend/stacked-area': 'i-daypart', 'trend/combo': 'i-money', 'trend/slope': 'i-operators',
  'trend/indexed': 'i-operators', 'trend/sparklines': 'i-operators', 'trend/model': 'i-journeys', 'ranking/bar': 'i-punctual', 'ranking/column': 'i-punctual', 'ranking/lollipop': 'i-punctual', 'ranking/dumbbell': 'i-then-now',
  'ranking/bullet': 'i-response', 'ranking/distribution': 'i-cost-field', 'ranking/aligned-bars': 'i-profile', 'ranking/boxplot': 'i-spread', 'composition/stacked-bar': 'i-daypart-peers', 'composition/stacked-column': 'i-daypart-peers',
  'composition/marimekko': 'i-daypart-peers', 'composition/waffle': 'i-fleet', 'composition/donut': 'i-revenue-parts', 'composition/treemap': 'i-fleet', 'composition/pie': 'i-revenue-parts', 'relationship/scatter': 'i-frequency',
  'relationship/bubble': 'i-lines', 'relationship/bubble-grid': 'i-lines', 'bridge/waterfall': 'i-bridge', 'scorecard/heatmap': 'i-profile', 'scorecard/bars': 'i-profile', 'lookup/table': 'i-profile', 'lookup/measure-table': 'i-operators',
  'numbers/fact-grid': 'i-estate', 'numbers/stat-list': 'i-estate', 'numbers/metric-strip': 'i-response', 'numbers/hero-number': 'i-response', 'panels/row': 'i-profile', 'panels/grid': 'i-profile', 'panels/stack': 'i-money' }};
const shaped = (type, insight) => (['trend'].includes(type) ? {{ ...insight, shape: 'series' }} : type === 'relationship' ? {{ ...insight, shape: 'measure-pair' }} : insight);
const out = {{}};
for (const [key, id] of Object.entries(CASES)) {{
  const [type, form] = key.split('/'), insight = shaped(type, insights.get(id));
  try {{
    const report = scaffoldReport(type, {{ id: 'p9', form, insight }});
    const compiled = compileDeck({{ deck: {{ id: 'd', design: 'consulting' }}, pages: [report.page] }}, {{ insights: new Map([[insight.id, insight]]), partial: true }});
    out[key] = {{ bound: report.bound.length, typed: report.typed, compiles: compiled.compileErrors.length === 0 && compiled.bindingFindings.length === 0, why: (report.fallback || []).join('; ').slice(0, 200) }};
  }} catch (error) {{ out[key] = {{ bound: 0, typed: [], compiles: false, why: error.message.slice(0, 200) }}; }}
}}
// Every form the fit table says is written from measures is one of the cases.
const bindable = CARRIERS.filter((row) => row.bound && !row.judged).map((row) => `${{row.type}}/${{row.form}}`);
console.log(JSON.stringify({{ out, uncovered: bindable.filter((key) => !CASES[key]) }}));
""")
        self.assertEqual(result["uncovered"], ["scorecard/progress"])   # percentages of a maximum: bound in the test below
        for key, got in result["out"].items():
            with self.subTest(form=key):
                self.assertTrue(got["bound"] > 0 and got["typed"] == [] and got["compiles"], got)

    def test_a_scaffold_takes_a_form_that_fits_the_insight_says_which_others_do_and_draws_them_by_the_decks_seed(self):
        result = run_node(f"""
import fs from 'node:fs';
import {{ scaffoldReport }} from '{KIT}/author-deck.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const of = (type, id, seed) => {{ const report = scaffoldReport(type, {{ id: 'p9', insight: insights.get(id), seed }}); return {{ form: report.form, fit: report.fit, kinds: [report.page.exhibit, ...(report.page.exhibits || [])].filter(Boolean).map((ex) => ex.type ?? null) }}; }};
const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
console.log(JSON.stringify({{ pair: of('ranking', 'i-then-now', null), field: of('ranking', 'i-cost-field', null), rank: seeds.map((seed) => of('ranking', 'i-punctual', seed).form), pairs: seeds.map((seed) => of('ranking', 'i-then-now', seed).form),
  rankFit: of('ranking', 'i-punctual', 'a').fit, progress: (() => {{ const insight = {{ ...insights.get('i-profile'), measures: {{ punctuality: insights.get('i-profile').measures.punctuality }} }}; const r = scaffoldReport('scorecard', {{ id: 'p9', form: 'progress', insight }}); return {{ bound: r.bound, typed: r.typed, column: r.page.exhibit.columns[1] }}; }})(),
  panels: seeds.map((seed) => of('panels', 'i-profile', seed).kinds.join('+')) }}));
""")
        # The form that carries the claim best, not the type's first: a dumbbell for two dates, the whole field for twenty members.
        self.assertEqual([result["pair"]["form"], result["field"]["form"]], ["dumbbell", "distribution"])
        self.assertEqual(result["pair"]["fit"]["task"], "pair")
        self.assertEqual(sorted(result["pair"]["fit"]["serves"]), ["aligned-bars", "bar", "column"])
        # Where two forms fit equally the seed draws between them, and the scaffold names the other; where one fits, every seed agrees.
        self.assertEqual(set(result["rank"]), {"bar", "lollipop"})
        self.assertEqual(set(result["pairs"]), {"dumbbell"})
        self.assertEqual(len(result["rankFit"]["equal"]), 1)
        self.assertEqual({result["rank"][0], *result["rankFit"]["equal"]}, {"bar", "lollipop"})
        # Panels take one kind for every cut that can take it, so they read across; the kind is the seed's.
        self.assertTrue(all(len(set(kinds.split("+"))) == 1 for kinds in result["panels"]), result["panels"])
        self.assertGreater(len(set(result["panels"])), 1)
        self.assertEqual([result["progress"]["bound"], result["progress"]["typed"], result["progress"]["column"]["type"]], [["i-profile/punctuality"], [], "progress"])

    def test_the_scaffold_command_names_the_fit_and_takes_the_form_the_page_declares(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = self.stage(tmp)
            said = cli(file, "--scaffold", "ranking", "--evidence", "i-then-now").stderr
            self.assertIn("Bound to i-then-now: ranking/dumbbell names i-then-now/fy19, i-then-now/fy26", said)
            self.assertIn("asks the reader to read two values in one unit for each member", said)
            self.assertIn("Serving it with the reader doing work:", said)
            lacking = cli(file, "--scaffold", "composition", "--evidence", "i-fleet").stderr
            self.assertIn("`donut` would carry it and the measures do not fill it: it needs five parts at most", lacking)
            # The plan's allocation, once copied into the page, is the form scaffolded.
            doc = json.loads(file.read_text(encoding="utf-8"))
            next(p for p in doc["pages"] if p.get("id") == "v09")["form"] = "lollipop"
            file.write_text(json.dumps(doc), encoding="utf-8")
            declared = cli(file, "--scaffold", "ranking", "--evidence", "i-punctual", "--id", "v09")
            self.assertIn('v09 declares form "lollipop" in variety.pages.json, so that form is scaffolded', declared.stderr)
            self.assertEqual(json.loads(declared.stdout)["form"], "lollipop")


class BindingTests(unittest.TestCase):
    PROBE = f"""
import fs from 'node:fs';
import {{ bindDeck }} from '{KIT}/bind.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const bound = (page) => {{ const written = bindDeck({{ pages: [{{ id: 'p1', title: 't', why: 'w', commentary: 'none', ...page }}] }}, insights); return {{ ex: written.doc.pages[0].exhibit, refused: written.findings.map((f) => f.repair) }}; }};
"""

    def test_a_scatter_a_bullet_a_box_plot_and_a_table_turned_over_are_written_from_measures(self):
        result = run_node(self.PROBE + """
const scatter = bound({ type: 'relationship', form: 'scatter', evidence: ['i-frequency'], exhibit: { points: { x: { measure: 'i-frequency/frequency' }, y: { measure: 'i-frequency/growth' } }, select: { members: ['Northvale', 'Coast', 'Midland'] } } });
const bullet = bound({ type: 'ranking', form: 'bullet', evidence: ['i-response'], exhibit: { series: [{ measure: 'i-response/response' }], targets: { measure: 'i-response/standard' } } });
const box = bound({ type: 'ranking', form: 'boxplot', evidence: ['i-spread'], exhibit: { series: ['min', 'q1', 'median', 'q3', 'max'].map((name) => ({ measure: `i-spread/${name}` })) } });
const four = bound({ type: 'ranking', form: 'boxplot', evidence: ['i-spread'], exhibit: { series: ['min', 'q1', 'median', 'q3'].map((name) => ({ measure: `i-spread/${name}` })) } });
// The members' series at two dates, turned over: a dumbbell from six series over time.
const turned = bound({ type: 'ranking', form: 'dumbbell', evidence: ['i-operators'], exhibit: { series: ['northvale', 'coast', 'midland', 'harbour'].map((name) => ({ measure: `i-operators/${name}` })), select: { periods: ['FY19', 'FY26'] }, pivot: true } });
const multiples = bound({ type: 'trend', form: 'sparklines', evidence: ['i-operators'], exhibit: { series: ['northvale', 'coast', 'midland'].map((name) => ({ measure: `i-operators/${name}` })) } });
const tiles = bound({ type: 'composition', form: 'treemap', evidence: ['i-fleet'], exhibit: { measure: 'i-fleet/fleet' } });
const combo = bound({ type: 'trend', form: 'combo', evidence: ['i-money'], exhibit: { series: [{ measure: 'i-money/revenue' }, { measure: 'i-money/punctuality' }] } });
const wrongTarget = bound({ type: 'ranking', form: 'bullet', evidence: ['i-response', 'i-punctual'], exhibit: { series: [{ measure: 'i-response/response' }], targets: { measure: 'i-punctual/punctuality' } } });
console.log(JSON.stringify({ scatter, bullet: { targets: bullet.ex.targets, basis: bullet.ex.basis.measures, refused: bullet.refused }, box: { boxes: box.ex.boxes?.slice(0, 1), categories: box.ex.categories, refused: box.refused }, four: four.refused,
  turned: { categories: turned.ex.categories, series: turned.ex.series, refused: turned.refused }, multiples: multiples.ex.items?.map((item) => [item.label, item.values.length]), tiles: tiles.ex.items?.slice(0, 2),
  combo: { secondaryAxis: combo.ex.secondaryAxis, secondaryUnit: combo.ex.secondaryUnit, refused: combo.refused }, wrongTarget: wrongTarget.refused }));
""")
        scatter = result["scatter"]
        self.assertEqual(scatter["refused"], [])
        self.assertEqual(scatter["ex"]["points"], [{"name": "Northvale", "x": 58, "y": 19}, {"name": "Coast", "x": 54, "y": 17}, {"name": "Midland", "x": 38, "y": 14}])
        self.assertEqual([scatter["ex"]["xLabel"], scatter["ex"]["yLabel"]], ["frequency, trains a weekday", "growth, %"])
        self.assertEqual(scatter["ex"]["basis"]["measures"], ["i-frequency/frequency", "i-frequency/growth"])
        # One value set against every row, and the target is part of what the exhibit rests on.
        self.assertEqual([result["bullet"]["targets"], result["bullet"]["basis"], result["bullet"]["refused"]], [[9] * 8, ["i-response/response", "i-response/standard"], []])
        self.assertEqual(result["box"]["boxes"], [{"min": 78, "q1": 81, "median": 84, "q3": 87, "max": 90}])
        self.assertEqual(len(result["box"]["categories"]), 6)
        self.assertIn("a box plot written from measures names five, in order - min, q1, median, q3, max", result["four"][0])
        self.assertEqual(result["turned"]["categories"], ["northvale", "coast", "midland", "harbour"])
        self.assertEqual([s["name"] for s in result["turned"]["series"]], ["FY19", "FY26"])
        self.assertEqual(result["turned"]["series"][0]["values"], [20, 26, 32, 38])
        self.assertEqual(result["multiples"], [["northvale", 8], ["coast", 8], ["midland", 8]])
        self.assertEqual(result["tiles"], [{"label": "Class 150", "value": 42}, {"label": "Class 158", "value": 38}])
        self.assertEqual([result["combo"]["secondaryAxis"], result["combo"]["secondaryUnit"], result["combo"]["refused"]], [True, "%", []])
        self.assertIn("a target is in the unit of what it is a target for", result["wrongTarget"][0])

    def test_a_bridge_is_bound_to_its_totals_and_steps_and_refused_unless_they_reconcile(self):
        result = run_node(self.PROBE + """
const steps = { id: 'i-steps', shape: 'bridge', finding: 'f', soWhat: 's', strength: 'strong', measures: { effect: { unit: 'm journeys', population: 'Northvale Rail', period: 'FY25 to FY26', members: ['New timetable', 'Fares', 'Strikes', 'Weather', 'Events'], values: [2.6, 0.9, -1.1, -0.4, 1.5] } } };
insights.set('i-steps', steps);
const page = (bridge) => bound({ type: 'bridge', form: 'waterfall', evidence: ['i-journeys', 'i-steps'], exhibit: { bridge } });
const whole = page({ from: { measure: 'i-journeys/journeys@FY25' }, steps: { measure: 'i-steps/effect' }, to: { measure: 'i-journeys/journeys@FY26' } });
insights.set('i-steps', { ...steps, measures: { effect: { ...steps.measures.effect, values: [2.6, 0.9, -1.1, -0.4, 0.5] } } });
const short = page({ from: { measure: 'i-journeys/journeys@FY25' }, steps: { measure: 'i-steps/effect' }, to: { measure: 'i-journeys/journeys@FY26' } });
const named = page({ from: { measure: 'i-journeys/journeys@FY25' }, steps: { measure: 'i-steps/effect' }, to: { measure: 'i-journeys/journeys@FY26' }, residual: 'Unexplained' });
console.log(JSON.stringify({ whole, short: short.refused, named: { categories: named.ex.categories, values: named.ex.values, refused: named.refused } }));
""")
        whole = result["whole"]
        self.assertEqual(whole["refused"], [])
        self.assertEqual(whole["ex"]["categories"], ["FY25", "New timetable", "Fares", "Strikes", "Weather", "Events", "FY26"])
        self.assertEqual([whole["ex"]["values"], whole["ex"]["totals"], whole["ex"]["unit"]], [[48.8, 2.6, 0.9, -1.1, -0.4, 1.5, 52.3], [0, 6], "m journeys"])
        # A difference the steps leave is refused with its size, and drawn only as a step that says it is unexplained.
        self.assertIn("the steps leave 1 m journeys between i-journeys/journeys@FY25 (48.8) and i-journeys/journeys@FY26 (52.3)", result["short"][0])
        self.assertIn('`residual: "Unexplained"`', result["short"][0])
        self.assertEqual([result["named"]["categories"][-2:], result["named"]["values"][-2:], result["named"]["refused"]], [["Unexplained", "FY26"], [1, 52.3], []])


class ReaderTests(unittest.TestCase):
    """The fit search, the storyline critic and the deck reviewer read the same definition."""

    def test_the_fit_search_tries_the_forms_that_carry_the_claim_first_and_says_when_an_alternative_is_weaker(self):
        result = run_node(LOAD + f"""
import {{ alternativeChoices, fitLines }} from '{KIT}/fit-search.mjs';
const ranking = {{ ...page('v09'), form: 'bar', commentary: 'beside' }};
const grades = (p) => (form) => {{ const f = fit({{ ...p, form }}); return f?.task ? f.forms.ranked.find((item) => item.form === form)?.grade ?? 0 : null; }};
const order = (choices) => [...new Set(choices.map((choice) => choice.form))];
const lines = fitLines({{ pass: [{{ form: 'lollipop', commentary: 'beside' }}, {{ form: 'column', commentary: 'beside', weaker: 1 }}], partial: [], fail: [], needs: [], untried: [], capped: null }});
const only = fitLines({{ pass: [{{ form: 'column', commentary: 'beside', weaker: 1 }}], partial: [], fail: [], needs: [], untried: [], capped: null }});
console.log(JSON.stringify({{ fitted: order(alternativeChoices(ranking, grades(ranking))), plain: order(alternativeChoices(ranking)), lead: lines.lead, lines: lines.lines, only: only.lead }}));
""")
        # The same form first, then lollipop - the other best fit for ten members - then the forms that serve, then the rest in the catalogue's order.
        self.assertEqual(result["fitted"][:3], ["bar", "lollipop", "column"])
        self.assertEqual(result["plain"][:3], ["bar", "column", "lollipop"])
        # The lead names the alternative that carries the claim as directly; the weaker one is listed, and says what it is.
        self.assertIn('With the same content, form "lollipop", commentary "beside" passes the scene checks', result["lead"])
        self.assertNotIn("column", result["lead"])
        self.assertIn("a weaker fit for the claim than the page's own form - it carries it with the reader doing work", result["lines"][1])
        self.assertNotIn("weaker fit", result["lines"][0])
        self.assertIn("each a weaker fit for the claim than the form the page has", result["only"])

    def test_the_critic_is_told_where_another_page_type_carries_the_claim_and_the_reviewer_what_the_fit_read(self):
        result = run_node(LOAD + f"""
import path from 'node:path';
import os from 'node:os';
import {{ compileDeck, planOf }} from '{KIT}/author-deck.mjs';
import {{ allocateStructure }} from '{KIT}/deck-structure.mjs';
import * as S from '{KIT}/storyline.mjs';
import {{ reviewFit }} from '{KIT}/fit-review.mjs';
import {{ reviewPrompt, CODES }} from '{KIT}/reviewer.mjs';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-readers-'));
fs.copyFileSync(dir + '/variety.insights.json', path.join(tmp, 'variety.insights.json'));
fs.mkdirSync(path.join(tmp, 'sources'));
for (const item of log) for (const file of item.sources) fs.writeFileSync(path.join(tmp, file), 'illustrative');
// The spine with the plan's allocation, and one page drawn against its claim: two dates of ten operators as paired bars.
const plan = allocateStructure({{ ...doc, deck: {{ ...doc.deck, variation: 's1' }} }}, {{ insights, planOf }});
const pages = doc.pages.map((p) => {{ const given = plan.pages.find((x) => x.id === p.id); return given ? {{ ...p, form: p.id === 'v04' ? 'bar' : given.form, commentary: given.commentary }} : p; }});
const compiled = compileDeck({{ ...doc, pages }}, {{ insights, draft: true, partial: true }});
const specPath = path.join(tmp, 'variety.deck.json');
fs.writeFileSync(specPath, JSON.stringify(compiled.spec));
const step = await S.prepareStoryline(specPath, path.join(tmp, 'out'));
const packet = JSON.parse(fs.readFileSync(path.join(step.dir, 'packet.json'), 'utf8'));
const prompt = fs.readFileSync(path.join(step.dir, 'prompt.md'), 'utf8');
const read = await reviewFit(compiled.spec, specPath);
const review = (fit) => reviewPrompt({{ statistics: {{}}, titles: [], slides: [], codes: CODES, schema: {{}}, montage: 'm', fit }});
console.log(JSON.stringify({{ failed: compiled.compileErrors.length, noted: packet.pages.filter((p) => p.fit).map((p) => [p.id, p.fit]), line: prompt.split('\\n').find((text) => text.includes('[v30]')) ?? '',
  check: S.STORYLINE_CHECKS.shape.checks, read, withFit: review(read), without: review([]), noLog: await reviewFit(compiled.spec, path.join(os.tmpdir(), 'nowhere', 'variety.deck.json')) }}));
""")
        self.assertEqual(result["failed"], 0)
        # A table of six series over time is the one page whose type the fit questions: charts would carry it, and the critic judges.
        self.assertEqual([page_id for page_id, _ in result["noted"]], ["v30"])
        self.assertIn("| fit: its measures ask the reader to read which of five or more series moved over the same periods, which trend/line or trend/sparklines would carry directly", result["line"])
        self.assertIn("where a page's line ends in `fit:`", result["check"])
        # The reviewer is shown what the runtime read of the deck as drawn, as advisories to confirm or answer.
        self.assertEqual([item["code"] for item in result["read"]], ["VARIETY_FIT_UNUSED"])
        self.assertEqual(result["read"][0]["pages"], ["v04"])
        self.assertIn("Exhibit choice, read by the runtime from the measures each page shows", result["withFit"])
        self.assertIn("- VARIETY_FIT_UNUSED: v04: form `bar` carries it with the reader doing work; `dumbbell` carries it directly", result["withFit"])
        self.assertNotIn("Exhibit choice, read by the runtime", result["without"])
        self.assertEqual(result["noLog"], [])   # a deck with no insight log beside it has no fit to read


class StandingTests(unittest.TestCase):
    PROBE = f"""
import fs from 'node:fs';
import {{ fitStandings, KIND_SHARE }} from '{KIT}/gates/variety_gates.mjs';
import {{ fitsOf, keptAsSource }} from '{KIT}/deck-structure.mjs';
import {{ standingLine, classOf }} from '{KIT}/gates/gate_classes.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const insights = new Map(log.map((item) => [item.id, item]));
const slide = (id, type, form, kind, refs, more = {{}}) => ({{ id, title: id, exhibit: {{ type: kind, basis: {{ measures: refs }} }}, pageType: {{ type, form, commentary: 'none', content: {{ settles: {{ kind: 'comparison', what: 'w', measures: refs }}, evidence: [...new Set(refs.map((ref) => ref.split('/')[0]))] }}, ...more }} }});
// A deck of rankings and trends drawn as bars and lines: two dozen exhibits of two kinds.
const slides = [...Array.from({{ length: 12 }}, (_, i) => slide(`r${{i}}`, 'ranking', 'bar', 'chart.bar', ['i-punctual/punctuality'])), ...Array.from({{ length: 11 }}, (_, i) => slide(`t${{i}}`, 'trend', 'line', 'chart.line', ['i-journeys/journeys'])),
  slide('pair', 'ranking', 'bar', 'chart.bar', ['i-then-now/fy19', 'i-then-now/fy26'])];
const read = (spec, kept = keptAsSource(spec)) => {{ const {{ findings, standings }} = fitStandings(spec, {{ fits: fitsOf(spec, insights), kept }}); return {{ findings: findings.map((f) => ({{ code: f.code, severity: f.severity, slide: f.slide, repair: f.repair }})),
  lines: standings.map((standing) => standingLine(standing)), blocks: standings.map((standing) => standing.blocks), classes: standings.map((standing) => classOf(standing.code)) }}; }};
"""

    def test_the_share_of_the_commonest_kinds_and_the_fit_left_unused_are_said_on_every_run_and_never_refused(self):
        result = run_node(self.PROBE + """
console.log(JSON.stringify({ deck: read({ id: 'd', slides }), short: read({ id: 'd', slides: slides.slice(0, 20) }), mark: KIND_SHARE,
  none: fitStandings({ id: 'd', slides }, {}).standings.map((standing) => standing.code) }));
""")
        deck = result["deck"]
        self.assertEqual([f["code"] for f in deck["findings"]], ["VARIETY_KIND_SHARE", "VARIETY_FIT_UNUSED"])
        self.assertEqual({f["severity"] for f in deck["findings"]}, {"advisory"})
        self.assertEqual([deck["blocks"], deck["classes"]], [[False, False], ["S", "S"]])
        share, unused = deck["lines"]
        self.assertIn("VARIETY_KIND_SHARE: exhibits drawn in the 3 commonest kinds (chart.bar 13, chart.line 11), of 24 100%; cap 55%: over by 45% - advisory", share)
        self.assertIn("not a bar calibrated on the reference decks", share)
        # The standing names what is free to differ, since an advisory's repair is not printed with a refusal.
        self.assertIn("r0 ranking/bar (or lollipop)", share)
        self.assertIn("and 17 more", share)
        self.assertIn("VARIETY_FIT_UNUSED: pages drawn in a form that carries their claim less directly than another they could take 1; cap 0: over by 1 page - advisory", unused)
        self.assertIn("pair form bar -> dumbbell", unused)
        # The advice is to take another form of equal fit, and names them: never to draw a claim in a weaker form.
        self.assertIn("r0 (ranking/bar) is carried as directly by lollipop", deck["findings"][0]["repair"])
        self.assertIn("r11 (ranking/bar) is carried as directly by lollipop; and 11 more", deck["findings"][0]["repair"])
        self.assertIn("pair: form `bar` carries it with the reader doing work; `dumbbell` carries it directly", deck["findings"][1]["repair"])
        # Under two dozen exhibits three kinds carry most of any deck and the share says nothing; without an insight log only the share is read.
        self.assertEqual(result["short"]["findings"], [])
        self.assertIn("not held yet", result["short"]["lines"][0])
        self.assertEqual(result["none"], ["VARIETY_KIND_SHARE"])
        self.assertEqual(result["mark"], {"top": 3, "max": 0.55, "from": 24})

    def test_a_deck_whose_mix_follows_from_its_claims_is_told_so(self):
        result = run_node(self.PROBE + """
const pinned = [...Array.from({ length: 13 }, (_, i) => slide(`w${i}`, 'bridge', 'waterfall', 'chart.waterfall', ['i-bridge/journeys'])), ...Array.from({ length: 12 }, (_, i) => slide(`b${i}`, 'ranking', 'boxplot', 'chart.boxplot', ['min', 'q1', 'median', 'q3', 'max'].map((n) => `i-spread/${n}`)))];
console.log(JSON.stringify(read({ id: 'd', slides: pinned })));
""")
        self.assertEqual([f["code"] for f in result["findings"]], ["VARIETY_KIND_SHARE"])
        self.assertIn("None of the pages in those kinds is carried as directly by another form, so the mix follows from what the pages claim", result["findings"][0]["repair"])
        self.assertIn("no page in those kinds is carried as directly by another form", result["lines"][0])

    def test_on_a_revision_the_imported_pages_are_counted_and_only_the_pages_it_drew_are_judged(self):
        # The user's deck is theirs: a page kept as its source slide drew it is never named, and the share is a standing, never an advisory.
        result = run_node(self.PROBE + """
const imported = slides.map((s, i) => ({ ...s, pageType: { ...s.pageType, sourceSlide: i + 1 } }));
const added = slide('new', 'ranking', 'bar', 'chart.bar', ['i-then-now/fy19', 'i-then-now/fy26']);
const spec = { id: 'd', workflow: 'existing_deck_revision', slides: [...imported, added] };
// What each source slide drew, from the inventory: every page is drawn as its slide was but the last, a table then and redrawn as bars.
const sourceKinds = new Map(imported.map((s, i) => [i + 1, [i === imported.length - 1 ? 'table' : s.exhibit.type]]));
console.log(JSON.stringify({ blind: read(spec), told: read(spec, keptAsSource(spec, sourceKinds)), kept: [...keptAsSource(spec, sourceKinds)].length, fresh: keptAsSource({ id: 'd', slides }) }));
""")
        for reading in ("blind", "told"):
            with self.subTest(reading=reading):
                got = result[reading]
                self.assertEqual([f["code"] for f in got["findings"]], ["VARIETY_FIT_UNUSED"])
                self.assertIn("of the deck's pages are kept as the source deck drew them, counted here and not judged", got["lines"][0])
                self.assertIn("read of the imported deck as revised, which a revision does not redraw", got["lines"][0])
                self.assertNotIn("free to differ", got["lines"][0])
        # Without the inventory every imported page is the user's; with it, the page the revision redrew is the revision's own.
        self.assertEqual(result["blind"]["findings"][0]["slide"], ["new"])
        self.assertEqual(result["told"]["findings"][0]["slide"], ["pair", "new"])
        self.assertEqual(result["kept"], 23)
        self.assertIsNone(result["fresh"])


if __name__ == "__main__":
    unittest.main()
