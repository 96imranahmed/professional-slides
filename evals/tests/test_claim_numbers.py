"""A title's numbers are held to the record where they are written, and a writer reads each page against it.

A self-check of a hundred-page deck found titles that rounded a record the
wrong way ("about 13%" for 13.7%) or printed a figure no record held. A title's
number is now refused at the spine unless it is a measure's value at the
precision printed, or a figure an evidence finding states, and the claims sheet
sets each sentence of a page beside the findings it rests on and the recorded
value of each number in it.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"


class PrintedNumberTests(unittest.TestCase):
    def test_a_titles_number_is_the_records_at_its_rounding_and_a_range_takes_its_scale(self):
        result = run_node('''
import { measurementsIn, states } from './skills/professional-slides/runtime/printed-numbers.mjs';
const one = (text) => measurementsIn(text)[0];
console.log(JSON.stringify({
  range: measurementsIn('IAG guides €8.3-8.6bn for 2026 fuel').map((n) => [n.shown, n.n, n.scale]),
  percent: measurementsIn('margins of 5-6% in 2025').map((n) => [n.n, n.percent]),
  season: measurementsIn('the 2024-25 season').length,
  rounded: [states(one('4% less flying'), -4.3, { unit: '%', rounded: true }), states(one('about 13%'), 13.7, { unit: '%', rounded: true }), states(one('about 14%'), 13.7, { unit: '%', rounded: true })],
  strict: states(one('4% less flying'), -4.3, { unit: '%' }),
}));
''')
        self.assertEqual(result["range"], [["€8.3", 8.3, 1e9], ["8.6bn", 8.6, 1e9]])
        self.assertEqual(result["percent"], [[5, True], [6, True]])
        self.assertEqual(result["season"], 0)
        self.assertEqual(result["rounded"], [True, False, True], "4% is 4.3% rounded; 13% is not 13.7%")
        self.assertFalse(result["strict"], "elsewhere a printed number keeps two figures of its value")


class TitleNumberTests(unittest.TestCase):
    """The finance fixture deck, with one page's title made to print a number no record holds."""

    def compile(self, mutate):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ dependencyFindings }} from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
for (const f of ['finance.insights.json', 'finance.analysis.json']) fs.copyFileSync(path.join('{FIXTURES}', f), path.join(dir, f));
const doc = JSON.parse(fs.readFileSync(path.join('{FIXTURES}', 'finance.pages.json'), 'utf8'));
({mutate})(doc);
const insights = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const titles = dependencyFindings(doc, insights).filter((f) => f.code === 'TITLE_NUMBER_UNTRACED');
console.log(JSON.stringify({{ titles: titles.map((f) => [f.id, f.measured]),
  pages: doc.pages.filter((p) => p.type).map((p) => [p.id, p.title, p.evidence]) }}));
''')
        return result

    def test_a_titles_number_no_record_holds_is_refused(self):
        clean = self.compile("(doc) => {}")
        self.assertEqual(clean["titles"], [])
        page = clean["pages"][1][0]
        result = self.compile(f"(doc) => {{ doc.pages.find((x) => x.id === {json.dumps(page)}).title = 'Lending rose 37.5% while deposits held'; }}")
        self.assertEqual(result["titles"], [[page, ["37.5%"]]])


class ClaimSheetTests(unittest.TestCase):
    def test_the_sheet_sets_each_sentence_against_the_record(self):
        home = Path(tempfile.mkdtemp(prefix="claim-sheet-"))
        try:
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                shutil.copy(FIXTURES / name, home / name)
            doc = json.loads((home / "finance.pages.json").read_text(encoding="utf-8"))
            page = next(p for p in doc["pages"] if p.get("type"))
            page["subtitle"] = "Lending rose 37.5% in the quarter"
            (home / "finance.pages.json").write_text(json.dumps(doc), encoding="utf-8")
            run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(home / "finance.pages.json"), "--claims", page["id"]], capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 0, run.stderr)
            lines = run.stdout.splitlines()
            self.assertTrue(lines[0].startswith(f"{page['id']}  "))
            self.assertTrue(any(line.startswith("  evidence ") for line in lines))
            # A number no record holds is marked; a number the record holds is set beside its cell.
            self.assertIn("  CHECK subtitle: Lending rose 37.5% in the quarter", lines)
            self.assertIn("        37.5%: no recorded value at this precision", lines)
            self.assertTrue(any(line.startswith("        ") and " = " in line for line in lines))
            # Every other page is left out when pages are named.
            self.assertEqual(sum(1 for line in lines if line and not line.startswith(" ")), 1)
        finally:
            shutil.rmtree(home, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
