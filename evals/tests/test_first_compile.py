"""Everything a first run can know is said at the first run.

Two real runs learned these a compile at a time: a subtitle found too long
only once the title over it was shortened, and on other pages only once
another refusal was mended; an insight log the analyses ran over that the
pages then refused; seventy insights whose `sources` were not files, told to
the storyline critic as problems and never to the author; and a table too
long for one page refused as a text plan with nothing listed.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, SKILL, run_node

RUNTIME = SKILL / "runtime"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
WORKED = '''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { authorDeck, compileDeck, readInsights, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { titleBandProblems } from './skills/professional-slides/runtime/page-types.mjs';
const worked = workedExamples();
const deckOf = (pages, deck = {}) => ({ deck: { ...worked.deck, ...deck }, ...(worked.sources ? { sources: worked.sources } : {}), pages });
const LONG = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen';
'''


def staged(tmp, mutate=None):
    for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
        shutil.copy(FIXTURES / name, Path(tmp) / name)
    if mutate:
        log = json.loads((Path(tmp) / "finance.insights.json").read_text(encoding="utf-8"))
        mutate(log)
        (Path(tmp) / "finance.insights.json").write_text(json.dumps(log), encoding="utf-8")
    return Path(tmp) / "finance.pages.json"


def cli(script, *args):
    return subprocess.run([NODE, str(RUNTIME / script), *map(str, args)], capture_output=True, text=True, cwd=ROOT, timeout=600)


class TitleBandTests(unittest.TestCase):
    def test_a_title_and_a_subtitle_that_are_both_long_are_refused_together_whatever_else_stops_the_page(self):
        result = run_node(WORKED + '''
const typed = structuredClone(worked.pages.filter((p) => p.type).slice(0, 8));
// One page with both lengths wrong; one with a long subtitle whose first refusal is something else.
typed[2].title = `${typed[2].title} and then some more words that take it well past fifteen`; typed[2].subtitle = LONG;
typed[4].subtitle = LONG; typed[4].takeaway = 7;
const said = (mode) => Object.fromEntries(compileDeck(deckOf(structuredClone(typed)), { partial: true, ...mode }).failed.filter((f) => [typed[2].id, typed[4].id].includes(f.id)).map((f) => [f.id === typed[2].id ? 'both' : 'other', f.message]));
// A title inside fifteen words is no version's refusal - version 3 lowered the bar to twelve, and it has been raised past the old fourteen
// since - and a revision under any version is still told its subtitle is long.
const thirteen = { title: 'Revenue grew faster than cost in every one of the last eight fiscal years', subtitle: LONG };
const older = titleBandProblems(thirteen, 'p', { rules: { workflow: 'existing_deck_revision', rulesVersion: 2 } });
const current = titleBandProblems(thirteen, 'p', { rules: { workflow: 'existing_deck_revision', rulesVersion: 6 } });
console.log(JSON.stringify({ full: said({}), draft: said({ draft: true }), older: [older.refused.map((m) => m.slice(0, 23)), older.waived.length], current: current.refused.length }));
''')
        for mode in ("full", "draft"):
            both, other = result[mode]["both"], result[mode]["other"]
            self.assertIn("TITLE_WORDS - the title runs to", both, mode)
            self.assertIn("; and its subtitle runs to 18 words; keep it to 16 or fewer", both, mode)
            self.assertIn("`takeaway` is the closing sentence", other, mode)
            self.assertIn("Also refused on this page, so mend it in the same edit: the subtitle runs to 18 words", other, mode)
        self.assertEqual(result["older"], [["p: the subtitle runs to"], 0])
        self.assertEqual(result["current"], 1)


class InsightLogTests(unittest.TestCase):
    def test_a_log_the_analyses_run_over_is_a_log_the_pages_compile_over(self):
        # A member measure with no `period` ran through analysis.mjs and was refused by the next command that read the log.
        def unperioded(log):
            del next(i for i in log["insights"] if i["id"] == "i-peers")["measures"]["margin"]["period"]

        with tempfile.TemporaryDirectory() as tmp:
            pages = staged(tmp, unperioded)
            analysed, catalogued, drafted = cli("analysis.mjs", pages), cli("analysis.mjs", pages, "--catalogue"), cli("author-deck.mjs", pages, "--draft")
            refusal = "i-peers/margin: say the `period` the numbers are for"
            for run in (analysed, catalogued, drafted):
                self.assertNotEqual(run.returncode, 0)
                self.assertIn("The insight log's measures are not valid:", run.stderr)
                self.assertIn(refusal, run.stderr)
            self.assertFalse((Path(tmp) / "finance.analysis-results.json").exists())
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(cli("analysis.mjs", staged(tmp)).returncode, 0)

    def test_sources_that_are_not_files_are_said_at_the_compile_all_at_once_and_for_a_revision_too(self):
        result = run_node(WORKED + f'''
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
import {{ unfiledSources }} from './skills/professional-slides/runtime/storyline.mjs';
const FIX = {json.dumps(str(FIXTURES))};
const run = async (deckPatch, file) => {{
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unfiled-'));
  for (const name of ['finance.insights.json', 'finance.analysis.json']) await fs.copyFile(path.join(FIX, name), path.join(dir, name));
  const doc = JSON.parse(await fs.readFile(path.join(FIX, 'finance.pages.json'), 'utf8'));
  doc.deck = {{ ...doc.deck, ...deckPatch }};
  const log = JSON.parse(await fs.readFile(path.join(dir, 'finance.insights.json'), 'utf8'));
  if (file) {{ await fs.mkdir(path.join(dir, 'sources')); for (const item of log.insights) for (const source of item.sources) await fs.writeFile(path.join(dir, source), 'x'); }}
  const insights = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
  const out = await authorDeck(doc, {{ baseDir: dir, insights, draft: true }});
  await fs.rm(dir, {{ recursive: true, force: true }});
  return [...out.blocking, ...out.advisories].filter((f) => f.code === 'SOURCES_UNFILED').map((f) => [f.severity, f.class, f.measured.insights, f.repair]);
}};
console.log(JSON.stringify({{ bare: await run({{}}, false), filed: await run({{}}, true), revision: await run({{ workflow: 'existing_deck_revision' }}, false),
  named: unfiledSources([{{ id: 'a', sources: ['Annual report 2025'] }}, {{ id: 'b', sources: [] }}, {{ id: 'c', sources: ['sources/c.csv'] }}], ['c.csv']) }}));
''')
        self.assertEqual(len(result["bare"]), 1)
        severity, cls, count, repair = result["bare"][0]
        self.assertEqual([severity, cls, count], ["advisory", "S", 7])
        self.assertIn('7 insights name sources that are not files under sources/ (i-loans: "sources/i-loans.csv"', repair)
        self.assertIn("the storyline critic is told the log has 7 unsourced findings", repair)
        self.assertEqual(result["filed"], [])
        self.assertEqual([entry[:3] for entry in result["revision"]], [["advisory", "S", 7]])
        self.assertEqual(result["named"], [{"id": "a", "none": False, "missing": ["Annual report 2025"]}, {"id": "b", "none": True, "missing": []}])


class SplitTableTests(unittest.TestCase):
    def test_a_table_too_long_for_one_page_says_it_splits_and_why_and_its_text_is_read(self):
        result = run_node(WORKED + '''
const long = (which, n) => { const page = structuredClone(worked.pages.find((p) => `${p.type}/${p.form}` === which)); const rows = page.exhibit.rows;
  page.exhibit.rows = Array.from({ length: n }, (_, i) => rows[i % rows.length].map((cell, k) => (k === 0 ? `${typeof cell === 'string' ? cell : cell.text ?? 'Row'} ${i + 1}` : cell)));
  return page; };
const read = async (which, deck = {}) => { const page = long(which, 30);
  const run = await authorDeck(deckOf([page], deck), { baseDir: './skills/professional-slides/examples', fit: false });
  const all = [...run.blocking, ...run.advisories].filter((f) => f.id === page.id);
  return { codes: all.map((f) => f.code), split: all.filter((f) => f.code === 'PAGE_SPLITS').map((f) => [f.severity, f.class, f.measured, f.repair]), blocks: run.content.pages.find((p) => p.id === page.id).textPlan.length }; };
console.log(JSON.stringify({ heat: await read('scorecard/heatmap'), table: await read('lookup/table'), revision: await read('lookup/table', { workflow: 'existing_deck_revision' }) }));
''')
        for name in ("heat", "table", "revision"):
            page = result[name]
            self.assertNotIn("TEXT_PLAN_INCOMPLETE", page["codes"], name)
            self.assertGreater(page["blocks"], 60, name)                  # both parts' text reaches the content plan
            self.assertEqual(len(page["split"]), 1, name)
            severity, cls, measured, repair = page["split"][0]
            self.assertEqual([severity, cls, measured], ["advisory", "P", {"slides": 2, "rows": 30, "rowsASlide": 15}], name)
            self.assertIn("is drawn as 2 slides: its table has 30 rows, and one page holds 15 of them at the densest setting a table takes", repair)
            self.assertIn("to hold one page, cut the table to 15 rows or fewer", repair)


if __name__ == "__main__":
    unittest.main()
