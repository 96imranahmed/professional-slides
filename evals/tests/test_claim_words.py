"""A claim's absolute words and its title's numbers are held to the record where they are written.

A self-check of a hundred-page deck found sixty claims that went further than
their records, a third of them one word: "no rival can buy into" a market
where slots had been sold, "second only to Iberia" in a set that left out
Ryanair, "every season" over nine of eleven, "most" upgrades resting on an
analyst's line, and "about 13%" for 13.7%. Repairing them after the build took
an hour and a quarter. These hold the checks that catch them where the page is
written: an absolute word no finding of the page's evidence says (refused in a
title, advised in the copy), a finding that ranks a member its own measure does
not, a title's number no record holds at its printed rounding, and the sheet a
writer reads before handing a page on.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"


class ClaimWordTests(unittest.TestCase):
    def test_the_families_of_absolute_words_and_what_is_not_one(self):
        result = run_node('''
import { claimWords, unheldWords } from './skills/professional-slides/runtime/claim-words.mjs';
const said = (text) => claimWords(text).map((w) => `${w.family}:${w.word}`);
console.log(JSON.stringify({
  words: Object.fromEntries([
    "Heathrow is Europe's busiest hub", "BA holds half of a full Heathrow that no rival can buy into",
    "earns a 15.2% margin, second only to Iberia", "the third-largest market", "BA has held over half the slots in every season",
    "most of what customers see lands in 2026", "flat only because Middle East passengers fell",
  ].map((t) => [t, said(t)])),
  // Not absolute: "only" before a quantity, "not only", a rate of growth, a unit's equivalence.
  plain: [
    "revenue only 30% higher", "Only 36% of the fleet is new", "only a third of the seats", "not only the fare but the wait",
    "The loan book grew by more than half in seven years", "Every minute a crew waits at the door is a minute it cannot be dispatched",
  ].map(said),
  held: unheldWords("IAG's US sales make it its third-largest market", ["EUR 5.5bn was sold in the USA, its third market after the UK and Spain"]),
  computed: unheldWords("Uplands is the slowest of eight districts", ["North ranks first of 8 on o-districts/response at 9.8 minutes"]),
  unheld: unheldWords("Europe is the world's largest premium market", ["Europe carried 39.7m premium passengers in 2025"]).map((w) => w.word),
}));
''')
        self.assertEqual(result["words"], {
            "Heathrow is Europe's busiest hub": ["top:busiest"],
            "BA holds half of a full Heathrow that no rival can buy into": ["every:no rival"],
            "earns a 15.2% margin, second only to Iberia": ["rank:second only to", "only:only"],
            "the third-largest market": ["rank:third-largest"],
            "BA has held over half the slots in every season": ["every:every"],
            "most of what customers see lands in 2026": ["most:most of"],
            "flat only because Middle East passengers fell": ["only:only"],
        })
        self.assertEqual(result["plain"], [[], [], [], [], [], []])
        self.assertEqual(result["held"], [], "a finding's place in a ranking holds a rank word")
        self.assertEqual(result["computed"], [], "a computed ranking holds a rank word")
        self.assertEqual(result["unheld"], ["largest"])

    def test_a_finding_ranks_a_member_its_own_measure_ranks_there(self):
        result = run_node('''
import { rankProblem } from './skills/professional-slides/runtime/claim-words.mjs';
const hubs = { pax: { unit: 'passengers m', population: 'four hubs', period: '2025', members: ['Heathrow', 'Istanbul', 'Paris CDG', 'Frankfurt'], values: [79.2, 80.1, 70.3, 63.2] } };
console.log(JSON.stringify({
  wrong: rankProblem({ id: 'h', finding: 'Heathrow is the busiest of the four hubs', measures: hubs }),
  right: rankProblem({ id: 'h', finding: 'Istanbul is the busiest of the four hubs', measures: hubs }),
  lowest: rankProblem({ id: 'h', finding: 'Frankfurt is the smallest of the four hubs', measures: hubs }),
  unranked: rankProblem({ id: 'p', finding: "Europe remained the world's largest premium market", measures: { europe: { unit: 'passengers m', population: 'Europe', periods: ['2024', '2025'], values: [39.3, 39.7] } } }),
  // A rank on a share is read off the shares, which level measures do not hold.
  share: rankProblem({ id: 's', finding: 'Northvale carries the largest weekend share of five operators', measures: { weekend: { unit: 'm journeys', population: 'five', period: 'FY26', members: ['Northvale', 'Coast', 'Ridge'], values: [14, 16, 22] } } }),
  // One measure naming the member is enough: the word ranks it on that one.
  either: rankProblem({ id: 'e', finding: 'Coast has the highest off-peak count', measures: { peak: { unit: 'm', population: 'p', period: 'FY26', members: ['Coast', 'Ridge', 'Vale'], values: [1, 5, 3] }, offPeak: { unit: 'm', population: 'p', period: 'FY26', members: ['Coast', 'Ridge', 'Vale'], values: [9, 5, 3] } } }),
}));
''')
        self.assertEqual(result["wrong"], {"kind": "wrong", "word": "busiest", "member": "Heathrow", "measure": "h/pax", "leader": "Istanbul"})
        self.assertIsNone(result["right"])
        self.assertIsNone(result["lowest"])
        self.assertEqual(result["unranked"], {"kind": "unranked", "word": "largest"})
        self.assertIsNone(result["share"])
        self.assertIsNone(result["either"])

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


class ClaimFindingTests(unittest.TestCase):
    """The finance fixture deck, with one page's title and copy made to overreach."""

    def compile(self, mutate, insights=None):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ dependencyFindings }} from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
for (const f of ['finance.insights.json', 'finance.analysis.json']) fs.copyFileSync(path.join('{FIXTURES}', f), path.join(dir, f));
const log = JSON.parse(fs.readFileSync(path.join(dir, 'finance.insights.json'), 'utf8'));
({insights or "() => {}"})(log); fs.writeFileSync(path.join(dir, 'finance.insights.json'), JSON.stringify(log));
const doc = JSON.parse(fs.readFileSync(path.join('{FIXTURES}', 'finance.pages.json'), 'utf8'));
({mutate})(doc);
const insights = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const spine = compileDeck(doc, {{ insights, draft: true, partial: true }}).spineFindings.filter((f) => /^(CLAIM|FINDING)_/.test(f.code));
const titles = dependencyFindings(doc, insights).filter((f) => f.code === 'TITLE_NUMBER_UNTRACED');
console.log(JSON.stringify({{ spine: spine.map((f) => [f.code, f.severity, f.id ?? f.pages, f.measured]), titles: titles.map((f) => [f.id, f.measured]),
  pages: doc.pages.filter((p) => p.type).map((p) => [p.id, p.title, p.evidence]) }}));
''')
        return result

    def test_a_titles_absolute_word_is_refused_and_the_copys_advised(self):
        clean = self.compile("(doc) => {}")
        self.assertEqual(clean["spine"], [], "the clean fixture deck says nothing its record does not")
        page, title, _ = clean["pages"][1]
        result = self.compile(f"""(doc) => {{ const p = doc.pages.find((x) => x.id === {json.dumps(page)});
            p.title = {json.dumps(title)} + ', the largest of any lender'; p.subtitle = 'Only Harbour reported in the quarter'; }}""")
        codes = [(code, severity, where) for code, severity, where, _ in result["spine"]]
        self.assertIn(("CLAIM_UNBACKED", "blocker", page), codes)
        self.assertIn(("CLAIM_UNBACKED", "advisory", page), codes)
        blocked = next(m for code, severity, _, m in result["spine"] if code == "CLAIM_UNBACKED" and severity == "blocker")
        self.assertEqual(blocked, ["largest"])

    def test_a_finding_that_misranks_is_refused_and_one_with_nothing_to_rank_in_advised_where_a_page_leans_on_it(self):
        result = self.compile("(doc) => {}", insights="""(log) => { log.insights.push({ id: 'i-rank', finding: 'Zed is the largest of three lenders', shape: 'fact',
            calculation: 'as filed', sources: ['sources/i-rank.csv'], soWhat: 'It bears on the decision', strength: 'context',
            measures: { book: { unit: 'GBP m', population: 'three lenders', period: 'FY26', members: ['Zed', 'Why', 'Ex'], values: [1, 5, 3] } } }); }""")
        self.assertIn(["FINDING_RANK_UNBACKED", "blocker", ["i-rank"]], [row[:3] for row in result["spine"]])

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
            page["subtitle"] = "Only Harbour reported in the quarter"
            (home / "finance.pages.json").write_text(json.dumps(doc), encoding="utf-8")
            run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(home / "finance.pages.json"), "--claims", page["id"]], capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 0, run.stderr)
            lines = run.stdout.splitlines()
            self.assertTrue(lines[0].startswith(f"{page['id']}  "))
            self.assertTrue(any(line.startswith("  evidence ") for line in lines))
            self.assertIn("  CHECK subtitle: Only Harbour reported in the quarter", lines)
            self.assertIn('        "only" (only): no evidence finding says one', lines)
            # A computed comparison holds a rank word: "Northgate leads on 3 of 4".
            self.assertTrue(any(line.startswith('        "lowest" (bottom): said by ') for line in lines))
            # Every other page is left out when pages are named.
            self.assertEqual(sum(1 for line in lines if line and not line.startswith(" ")), 1)
        finally:
            shutil.rmtree(home, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
