"""What the analysis, the insight log's readers and the evidence measure say of themselves is true.

An independent review found the analysis reading a percentage only where the
unit began with one, combining populations and summing a stock over time
without a word, and listing pairs nobody would compute; a log that could
record one id twice in one file; parts read from outside the deck's folder,
and a part that was not JSON answered with a stack trace; and an evidence
measure that no longer said what it does not catch. These hold the repair.
"""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

RUNTIME = ROOT / "skills" / "professional-slides" / "runtime"

LOG = '''
import { runAnalyses, analysisCatalogue } from './skills/professional-slides/runtime/analysis.mjs';
import { composeUnit, isPercentUnit, measureConflicts } from './skills/professional-slides/runtime/measures.mjs';
const FY = ['FY24', 'FY25', 'FY26'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: [] };
const items = [{ ...graded, id: 'a', shape: 'series', measures: {
  sites: { unit: 'clinics', population: 'North group', periods: FY, values: [10, 12, 15] },
  beds: { unit: 'beds', population: 'North group, beds at year end', periods: ['FY24', 'FY25'], values: [100, 110] },
  visits: { unit: 'm', population: 'North group', period: 'FY25', value: 140 },
  perSite: { unit: 'm per clinic', population: 'South group', period: 'FY25', value: 0.2 },
  share: { unit: '%', population: 'North group', period: 'FY25', value: 46 },
  bracketed: { unit: 'share (%)', population: 'North group', period: 'FY25', value: 46 },
  worded: { unit: 'per cent', population: 'North group', period: 'FY25', value: 46 },
  margin: { unit: 'margin %', population: 'North group', periods: FY, values: [9.4, -6.1, 2] },
  occupancy: { unit: '%', population: 'North group', periods: FY, values: [81, 78, 80] },
  rivalMargin: { unit: '%', population: 'South group', periods: FY, values: [5, 6, 7] },
  staff: { unit: 'people', population: 'North group', periods: FY, values: [50, 60, 70] },
  headcount: { unit: 'people', population: 'North group, payroll', periods: FY, values: [50, 60, 70] } } }];
const an = (o) => ({ soWhat: 'It bounds what the group can take', strength: 'strong', ...o });
const run = (analyses) => Object.fromEntries(runAnalyses({ analyses: analyses.map(an) }, items).results.map((r) => [r.id, r]));
'''


class PercentageTests(unittest.TestCase):
    def test_a_unit_is_a_percentage_wherever_it_says_so(self):
        result = run_node(LOG + '''
const by = run([
  { id: 'P-plain', op: 'product', inputs: ['a/share', 'a/visits'] }, { id: 'P-bracketed', op: 'product', inputs: ['a/bracketed', 'a/visits'] }, { id: 'P-worded', op: 'product', inputs: ['a/worded', 'a/visits'] },
  { id: 'G-margin', op: 'growth', inputs: ['a/margin'] }, { id: 'S-margin', op: 'sum', inputs: ['a/margin'] }, { id: 'R-per', op: 'ratio', inputs: ['a/visits', 'a/share'] }]);
console.log(JSON.stringify({
  is: ['%', 'margin %', 'share (%)', 'per cent', 'percent of seats', 'percentage points', 'pp', '% a period', 'm per %', 'GBP m', 'ratio', 'percentile rank'].map((unit) => [unit, isPercentUnit(unit)]),
  products: ['P-plain', 'P-bracketed', 'P-worded'].map((id) => [by[id].measures.result.value, by[id].measures.result.unit]),
  growth: Object.fromEntries(Object.entries(by['G-margin'].measures).map(([name, m]) => [name, [m.unit, m.value]])), sum: [by['S-margin'].status, by['S-margin'].reason],
  ratio: [by['R-per'].measures.result.value, by['R-per'].measures.result.unit, by['R-per'].boundaries], unit: composeUnit(['per cent', 'm'], [], { fractions: true }) }));
''')
        self.assertEqual(dict(result["is"]), {"%": True, "margin %": True, "share (%)": True, "per cent": True, "percent of seats": True, "percentage points": True, "pp": True, "% a period": True,
                                              "m per %": False, "GBP m": False, "ratio": False, "percentile rank": False})
        # However the unit words it, a percentage in a product is applied as the fraction it is.
        self.assertEqual(result["products"], [[64.4, "m"]] * 3)
        self.assertEqual(result["unit"], {"unit": "m", "simple": True, "scale": 0.01})
        # And moves in points: no percentage of a percentage, and its periods do not add up.
        self.assertEqual(result["growth"], {"change": ["percentage points", -7.4]})
        self.assertEqual(result["sum"][0], "unavailable")
        self.assertIn("the percentages of different periods do not add up to one", result["sum"][1])
        # A ratio reads the percentage as the number recorded, and says that it did.
        self.assertEqual(result["ratio"][:2], [3.043478, "m per %"])
        self.assertTrue(any("used as the number recorded" in note and 'op "product" applies a percentage as a fraction' in note for note in result["ratio"][2]), result["ratio"][2])


class BoundaryTests(unittest.TestCase):
    def test_a_result_across_populations_names_them_and_a_sum_over_periods_says_what_it_adds(self):
        result = run_node(LOG + '''
const by = run([
  { id: 'X-product', op: 'product', inputs: ['a/sites', 'a/perSite'] }, { id: 'X-gap', op: 'gap', inputs: ['a/margin', 'a/rivalMargin'], unit: 'margin %' },
  { id: 'X-ratio', op: 'ratio', inputs: ['a/occupancy', 'a/rivalMargin'] }, { id: 'X-sum', op: 'sum', inputs: ['a/staff', 'a/headcount'] },
  { id: 'One', op: 'gap', inputs: ['a/occupancy', 'a/share'], at: { 'a/occupancy': 'FY25' } }, { id: 'Stock', op: 'sum', inputs: ['a/beds'] }]);
const across = (id) => (by[id].boundaries || []).filter((note) => note.includes('across different populations'));
console.log(JSON.stringify({ status: Object.fromEntries(Object.entries(by).map(([id, r]) => [id, r.status])), product: across('X-product'), ratio: across('X-ratio'), sum: across('X-sum'), one: across('One'),
  stock: [by.Stock.measures.result.value, by.Stock.boundaries] }));
''')
        self.assertEqual(result["product"], ["a/sites describes North group and a/perSite describes South group: the result is across different populations"])
        self.assertEqual(len(result["ratio"]), 1)
        self.assertEqual(result["sum"], ["a/staff describes North group and a/headcount describes North group, payroll: the result is across different populations"])
        self.assertEqual(result["one"], [])  # one population: nothing to say
        value, notes = result["stock"]
        self.assertEqual(value, 210)
        self.assertEqual(len(notes), 1)
        self.assertIn("adds the 2 periods of a/beds (FY24 to FY25)", notes[0])
        self.assertIn("wrong for a stock or a level", notes[0])

    def test_the_catalogue_pairs_no_unlike_percentages_and_lists_no_pair_of_one_number(self):
        result = run_node(LOG + '''
const { entries, counts } = analysisCatalogue(items);
const pairs = entries.filter((e) => ['gap', 'ratio'].includes(e.entry.op)).map((e) => `${e.entry.op} ${e.entry.inputs.join(' ')}`);
console.log(JSON.stringify({ pairs, counts }));
''')
        pairs = result["pairs"]
        # A margin less an occupancy rate is no quantity, of one group or of two, however their populations are worded.
        self.assertNotIn("gap a/margin a/occupancy", pairs)
        self.assertNotIn("gap a/share a/occupancy", pairs)
        self.assertNotIn("gap a/occupancy a/rivalMargin", pairs)
        # Two records of the same numbers have a gap of zero everywhere: neither the gap nor the ratio is listed.
        self.assertFalse([pair for pair in pairs if "a/staff a/headcount" in pair], pairs)
        self.assertEqual(result["counts"]["sameNumbers"], 2)

    def test_differently_named_percentages_are_never_paired_and_one_quantity_for_two_groups_is(self):
        # "I59/margin less I59/loadFactor": two percentages of one insight whose populations were worded
        # differently ("eleven carriers, net margin", "eleven carriers, load factor") were still set against each other.
        result = run_node(LOG + '''
const more = [{ ...graded, id: 'c', shape: 'peer-set', measures: {
    margin: { unit: '%', population: 'eleven groups, net margin', period: 'FY25', members: ['P', 'Q', 'R', 'S'], values: [20.8, 15, 9.1, 8.4] },
    fill: { unit: '%', population: 'eleven groups, beds filled', period: 'FY25', members: ['P', 'Q', 'R', 'S'], values: [85, 79, 81, 83] } } },
  { ...graded, id: 'd', shape: 'series', measures: { occupancy: { unit: '%', population: 'South group', periods: FY, values: [70, 72, 75] } } },
  // The same margins recorded again for three of the four, one of them restated: a pair, since it is not the same numbers throughout.
  { ...graded, id: 'e', shape: 'peer-set', measures: { margin: { unit: '%', population: 'four regional groups, net margin', period: 'FY24-25', members: ['Q', 'P', 'R'], values: [15, 20.8, 8.5] } } },
  // And recorded again with nothing restated: one record written twice.
  { ...graded, id: 'f', shape: 'peer-set', measures: { margin: { unit: '%', population: 'the three largest, net margin', period: 'the latest year', members: ['P', 'Q', 'R'], values: [20.8, 15, 9.1] } } }];
const { entries, counts } = analysisCatalogue([...items, ...more]);
const pairs = Object.fromEntries(entries.filter((e) => ['gap', 'ratio'].includes(e.entry.op)).map((e) => [`${e.entry.op} ${e.entry.inputs.join(' ')}`, e.finding]));
console.log(JSON.stringify({ pairs, counts }));
''')
        pairs = result["pairs"]
        named = [pair for pair in pairs if pair.startswith("gap")]
        self.assertFalse([pair for pair in named if "c/fill" in pair], named)
        self.assertFalse([pair for pair in pairs if "a/rivalMargin" in pair and "a/occupancy" in pair], named)
        # One quantity under one name for two populations is still a pair.
        self.assertIn("gap a/occupancy d/occupancy", pairs)
        self.assertIn("gap c/margin e/margin", pairs)
        # Across members a result has no first and last: its range is said, so one restated member is not read as "0 to 0".
        self.assertEqual(pairs["gap c/margin e/margin"], "c/margin less e/margin ranges from 0 (P) to 0.6 (R) %")
        self.assertNotIn("gap c/margin f/margin", pairs)
        self.assertEqual(pairs["gap e/margin f/margin"], "e/margin less f/margin ranges from -0.6 (R) to 0 (Q) %")
        self.assertEqual(result["counts"]["sameNumbers"], 3)  # staff and headcount (a gap and a ratio), and the margins recorded twice (a gap)


class LogReaderTests(unittest.TestCase):
    def write(self, folder, name, value):
        path = Path(folder) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value if isinstance(value, str) else json.dumps(value), encoding="utf-8")
        return path

    def read_log(self, folder):
        return run_node(f'''
import {{ readInsightLog }} from './skills/professional-slides/runtime/measures.mjs';
let out; try {{ const log = await readInsightLog({json.dumps(str(folder))}, 'd'); out = {{ ids: log.insights.map((i) => i.id) }}; }} catch (error) {{ out = {{ refused: error.message }}; }}
console.log(JSON.stringify(out));
''')

    def test_an_id_written_twice_in_one_file_is_refused_like_one_written_in_two_parts(self):
        insight = lambda id, value: {"id": id, "measures": {"r": {"unit": "m", "population": "Co", "period": "x", "value": value}}}
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, "d.insights.json", {"insights": [insight("a", 1), insight("b", 3), insight("a", 2)]})
            refused = self.read_log(tmp)["refused"]
            self.assertIn("d.insights.json records an insight twice: a (entries 1 and 3)", refused)
            self.write(tmp, "d.insights.json", {"include": ["parts/one.json"], "insights": [insight("a", 1)]})
            self.write(tmp, "parts/one.json", {"insights": [insight("c", 1), insight("c", 2)]})
            self.assertIn("c is recorded in parts/one.json and in parts/one.json", self.read_log(tmp)["refused"])
        # Handed two records under one id, the conflict check compares them rather than taking them for one insight.
        result = run_node('''
import { measureConflicts } from './skills/professional-slides/runtime/measures.mjs';
const item = (value) => ({ id: 'a', measures: { r: { unit: 'm', population: 'Co', period: 'x', value }, s: { unit: 'm', population: 'Co', period: 'x', value: 9 } } });
console.log(JSON.stringify({ twice: measureConflicts([item(1), item(2)]).map((c) => [c.kind, c.refs]), once: measureConflicts([item(1)]) }));
''')
        self.assertEqual(result["twice"], [["contradiction", ["a/r", "a/r"]], ["duplicate", ["a/s", "a/s"]]])
        self.assertEqual(result["once"], [])

    def test_a_part_outside_the_decks_folder_is_refused_by_both_readers(self):
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            self.write(tmp, "outside/ins.json", {"insights": [{"id": "x"}]})
            self.write(tmp, "outside/secret.pages.json", {"pages": [{"id": "s1", "kind": "section", "title": "Elsewhere"}]})
            for path in ("../outside/ins.json", str(Path(tmp) / "outside" / "ins.json")):
                self.write(deck, "d.insights.json", {"include": [path], "insights": []})
                refused = self.read_log(deck)["refused"]
                self.assertIn("outside the folder of the log", refused)
            self.write(deck, "d.insights.json", {"include": ["parts/one.json", "./parts/one.json"], "insights": []})
            self.write(deck, "parts/one.json", {"insights": []})
            self.assertIn("twice", self.read_log(deck)["refused"])
            for path in ("../outside/secret.pages.json", str(Path(tmp) / "outside" / "secret.pages.json")):
                file = self.write(deck, "d.pages.json", {"deck": {"id": "d"}, "pages": [{"include": path}]})
                run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(file), "--check"], capture_output=True, text=True, timeout=120)
                self.assertEqual(run.returncode, 2)
                self.assertIn("which is outside the folder of d.pages.json", run.stderr)
                self.assertEqual(len(run.stderr.strip().splitlines()), 1, run.stderr)

    def test_a_part_that_links_outside_the_decks_folder_is_refused_like_one_named_outside_it(self):
        # `parts/one.json` reads as a path inside the folder; as a link to a file outside it, or a file under a linked
        # folder, it is that file. Both readers refuse it as they refuse `../`; a link that stays inside is a part.
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            self.write(tmp, "outside/ins.json", {"insights": [{"id": "x"}]})
            self.write(tmp, "outside/secret.pages.json", {"pages": [{"id": "s1", "kind": "section", "title": "Elsewhere"}]})
            self.write(deck, "parts/real.json", {"insights": []})
            self.write(deck, "parts/real.pages.json", {"pages": [{"id": "s2", "kind": "section", "title": "Here"}]})
            (deck / "parts" / "link.json").symlink_to(Path(tmp) / "outside" / "ins.json")
            (deck / "parts" / "link.pages.json").symlink_to(Path(tmp) / "outside" / "secret.pages.json")
            (deck / "linked").symlink_to(Path(tmp) / "outside", target_is_directory=True)
            (deck / "parts" / "within.json").symlink_to(deck / "parts" / "real.json")
            (deck / "parts" / "within.pages.json").symlink_to(deck / "parts" / "real.pages.json")
            for path in ("parts/link.json", "linked/ins.json"):
                self.write(deck, "d.insights.json", {"include": [path], "insights": []})
                refused = self.read_log(deck)["refused"]
                self.assertIn(f'`include` names "{path}", outside the folder of the log (a link that leads out of it is outside it too)', refused)
            self.write(deck, "d.insights.json", {"include": ["parts/within.json"], "insights": []})
            self.assertIsNone(self.read_log(deck).get("refused"))
            for path in ("parts/link.pages.json", "linked/secret.pages.json"):
                file = self.write(deck, "d.pages.json", {"deck": {"id": "d"}, "pages": [{"include": path}]})
                run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(file), "--check"], capture_output=True, text=True, timeout=120)
                self.assertEqual(run.returncode, 2)
                self.assertIn(f'includes "{path}", which is outside the folder of d.pages.json (it is a link, or under a linked folder, that leads out of it)', run.stderr)
                self.assertNotIn("Elsewhere", run.stderr)
                self.assertEqual(len(run.stderr.strip().splitlines()), 1, run.stderr)
            result = run_node(f"""
import {{ readPagesFileSync }} from './skills/professional-slides/runtime/pages-file.mjs';
import fs from 'node:fs';
fs.writeFileSync({json.dumps(str(deck / "d.pages.json"))}, JSON.stringify({{ deck: {{ id: 'd' }}, pages: [{{ include: 'parts/within.pages.json' }}, {{ include: 'parts/gone.pages.json' }}] }}));
let missing = null; try {{ readPagesFileSync({json.dumps(str(deck / "d.pages.json"))}); }} catch (error) {{ missing = error.message; }}
fs.writeFileSync({json.dumps(str(deck / "d.pages.json"))}, JSON.stringify({{ deck: {{ id: 'd' }}, pages: [{{ include: 'parts/within.pages.json' }}] }}));
console.log(JSON.stringify({{ pages: readPagesFileSync({json.dumps(str(deck / "d.pages.json"))}).pages.map((page) => page.id), missing }}));
""")
            self.assertEqual(result["pages"], ["s2"])
            self.assertIn("which cannot be read (ENOENT)", result["missing"])  # a part that is not there is still said to be missing, not outside

    def test_a_part_included_twice_is_refused_and_a_file_that_is_not_json_is_named_in_a_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, "a.pages.json", {"pages": [{"id": "s1", "kind": "section", "title": "One"}]})
            file = self.write(tmp, "d.pages.json", {"deck": {"id": "d"}, "pages": [{"include": "a.pages.json"}, {"include": "./a.pages.json"}]})
            run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(file), "--check"], capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 2)
            self.assertIn("a.pages.json is included twice: at d.pages.json entry 1 and at d.pages.json entry 2", run.stderr)
            # Not JSON: one line naming the file, with none of its contents and no stack trace - the part, the pages file, a part of the log.
            secret = "the-contents-of-the-file-stay-in-the-file"
            self.write(tmp, "a.pages.json", f'{{ "pages": [ {secret} ] }}')
            self.write(tmp, "d.pages.json", {"deck": {"id": "d"}, "pages": [{"include": "a.pages.json"}]})
            broken_log = self.write(tmp, "log/d.insights.json", {"include": ["part.json"], "insights": []})
            self.write(tmp, "log/part.json", f"not json: {secret}")
            self.write(tmp, "log/d.pages.json", {"deck": {"id": "d"}, "pages": []})
            whole = self.write(tmp, "whole/d.pages.json", f"{{ {secret}")
            for target, named in ((file, "a.pages.json"), (broken_log.parent / "d.pages.json", "part.json"), (whole, "d.pages.json")):
                run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(target), "--check"], capture_output=True, text=True, timeout=120)
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn(named, run.stderr)
                self.assertIn("is not valid JSON", run.stderr)
                self.assertNotIn(secret, run.stderr)
                self.assertNotIn("    at ", run.stderr)
                self.assertEqual(len(run.stderr.strip().splitlines()), 1, run.stderr)
            catalogue = subprocess.run([NODE, str(RUNTIME / "analysis.mjs"), str(broken_log.parent / "d.pages.json"), "--catalogue"], capture_output=True, text=True, timeout=120)
            self.assertEqual(catalogue.returncode, 2)
            self.assertNotIn(secret, catalogue.stderr)
            self.assertEqual(len(catalogue.stderr.strip().splitlines()), 1, catalogue.stderr)
            # The analysis plan is read the same way, by the compile and by the analysis run.
            self.write(tmp, "plan/d.insights.json", {"insights": []})
            self.write(tmp, "plan/d.analysis.json", f"{{ {secret}")
            planned = self.write(tmp, "plan/d.pages.json", {"deck": {"id": "d"}, "pages": []})
            for script, args in (("author-deck.mjs", ["--check"]), ("analysis.mjs", []), ("analysis.mjs", ["--catalogue"])):
                run = subprocess.run([NODE, str(RUNTIME / script), str(planned), *args], capture_output=True, text=True, timeout=120)
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("d.analysis.json is not valid JSON", run.stderr)
                self.assertNotIn(secret, run.stderr)
                self.assertEqual(len(run.stderr.strip().splitlines()), 1, run.stderr)


class EvidenceMeasureTests(unittest.TestCase):
    def test_the_measure_says_what_it_does_not_catch_and_which_catches_only_advise(self):
        result = run_node('''
import { measure, KNOWN_LIMITS } from './evals/quality/evidence-validity.mjs';
const out = await measure();
console.log(JSON.stringify({ accepted: out.accepted, limits: out.limits, named: Object.keys(KNOWN_LIMITS), advisory: Object.entries(out.seeded).filter(([, d]) => d.advisory).map(([name]) => name) }));
''')
        self.assertEqual(result["named"], ["a bare whole number in a sentence changed", "a year changed", "a number changed into another value of the same measure"])
        for name, counts in result["limits"].items():
            with self.subTest(limit=name):
                # Each limit is planted on a fixture page, so the table reports a count and not an absence.
                self.assertGreater(counts["planted"], 0)
                # None is caught today; a limit that starts being caught shows in its count, and never in acceptance.
                self.assertEqual(counts["caught"], 0)
        self.assertTrue(result["accepted"])
        # A typed cell is advised; the fixture pages' sentence numbers are in their titles, where a number no record holds is refused.
        self.assertEqual(result["advisory"], ["one typed cell of a table changed"])
        run = subprocess.run([NODE, str(ROOT / "evals" / "quality" / "evidence-validity.mjs")], cwd=ROOT, capture_output=True, text=True, timeout=300)
        self.assertEqual(run.returncode, 0)
        self.assertIn("Known limits (planted, not counted)", run.stdout)
        self.assertIn("one typed cell of a table changed (advisory)", run.stdout)
        self.assertNotIn("a typed number in a sentence changed (advisory)", run.stdout)
        self.assertNotIn("one plotted number changed (advisory)", run.stdout)


if __name__ == "__main__":
    unittest.main()
