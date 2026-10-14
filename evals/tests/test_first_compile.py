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
        self.assertEqual([severity, cls, count], ["advisory", "S", 8])
        self.assertIn('8 insights name sources that are not files under sources/ (i-loans: "sources/i-loans.csv"', repair)
        self.assertIn("the storyline critic is told the log has 8 unsourced findings", repair)
        self.assertEqual(result["filed"], [])
        self.assertEqual([entry[:3] for entry in result["revision"]], [["advisory", "S", 8]])
        self.assertEqual(result["named"], [{"id": "a", "none": False, "missing": ["Annual report 2025"]}, {"id": "b", "none": True, "missing": []}])


class SourceReadBackTests(unittest.TestCase):
    def test_a_number_its_own_source_file_does_not_print_is_told_to_the_author(self):
        """Nothing read a source back: a log could cite a file for numbers the file does not hold."""
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { unreadNumbers } from './skills/professional-slides/runtime/storyline.mjs';
import { measureProblems } from './skills/professional-slides/runtime/measures.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'readback-'));
await fs.mkdir(path.join(dir, 'sources'));
await fs.writeFile(path.join(dir, 'sources/jobs.csv'), 'year,financial_k,total_k\\n2019,484.5,"4,629.9"\\n2020,473.1,"4,171.1"\\n');
await fs.writeFile(path.join(dir, 'sources/rates.md'), 'The share stood at 12.4% in 2025.');
const m = (values, more = {}) => ({ unit: 'k', population: 'NYC', periods: values.map((_, i) => String(2019 + i)), values, ...more });
const items = [
  // As recorded, grouped in thousands, and as a percentage of a share recorded as a fraction: all read back.
  { id: 'ok', sources: ['sources/jobs.csv'], measures: { fin: m([484.5, 473.1]), total: m([4629.9, 4171.1]), jobs: m([484500, 473100]) } },
  { id: 'share', sources: ['sources/rates.md'], measures: { share: { unit: 'share', population: 'NYC', period: '2025', value: 0.124 } } },
  // A slipped column among columns that read back.
  { id: 'slipped', sources: ['sources/jobs.csv'], measures: { fin: m([484.5, 473.1]), total: m([4692.9, 4117.1]) } },
  // Worked out from what the file prints, and said so; and a number from another file, which names it.
  { id: 'computed', sources: ['sources/jobs.csv'], measures: { share: m([10.5, 11.3], { computed: 'financial jobs over all jobs in each year' }), rate: { unit: '%', population: 'NYC', period: '2025', value: 12.4, sources: ['sources/rates.md'] } } }];
// A publisher's PDF is read through pdftotext: a one-page PDF printing two figures, written by hand.
const stream = 'BT /F1 12 Tf 72 720 Td (Homes completed 4,874 in 2025 and 4,840 in 2024) Tj ET';
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\\nstream\\n${stream}\\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf = '%PDF-1.4\\n'; const offsets = [];
objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\\n${body}\\nendobj\\n`; });
const xref = pdf.length;
pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \\n`).join('')}trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF\\n`;
await fs.writeFile(path.join(dir, 'sources/report.pdf'), pdf);
items.push({ id: 'pdf', sources: ['sources/report.pdf'], measures: { done: m([4840, 4874]), slipped: m([4847, 4887]) } });
const out = await unreadNumbers(items, dir);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ out, refused: measureProblems({ id: 'x', measures: { s: m([1, 2], { computed: 'a ratio' }) } }) }));
''')
        self.assertEqual(result["out"], [{"id": "slipped", "measures": ["total"], "missing": ["total 4692.9", "total 4117.1"]},
                                         {"id": "pdf", "measures": ["slipped"], "missing": ["slipped 4847", "slipped 4887"]}])
        self.assertTrue(any("`computed` says how" in problem for problem in result["refused"]))

    def test_a_figure_the_source_prints_signed_is_found_at_that_sign_only(self):
        """The read-back dropped every sign: a loss the source prints as -12.4 read back as a recorded gain of 12.4."""
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { unreadNumbers } from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'signs-'));
await fs.mkdir(path.join(dir, 'sources'));
// The hyphen, the typographic minus, a plus, and an accounting negative standing as a cell of its own.
await fs.writeFile(path.join(dir, 'sources/margins.csv'), 'segment,change_pts,growth_pct\\nRetail,-12.4,+3.8\\nWholesale,\\u22122.7,(5.1)\\n');
await fs.writeFile(path.join(dir, 'sources/note.md'), 'Over 2020-24 the retail margin fell 12.4 points and wholesale rose 2.7; the largest segment (34%) held.');
const m = (values) => ({ unit: 'pts', population: 'segments', periods: values.map((_, i) => String(2024 + i)), values });
const items = [
  { id: 'signed', sources: ['sources/margins.csv'], measures: { change: m([-12.4, -2.7]), growth: m([3.8, -5.1]) } },
  { id: 'reversed', sources: ['sources/margins.csv'], measures: { change: m([12.4, 2.7]), growth: m([-3.8, 5.1]) } },
  // A direction given in words is found at either sign; a span of years and an aside in parentheses carry none.
  { id: 'worded', sources: ['sources/note.md'], measures: { fell: m([-12.4, 2.7]), magnitude: m([12.4, -2.7]), span: m([2020, 24]),
    share: { unit: '%', population: 'segments', period: '2025', value: 34 } } }];
const out = await unreadNumbers(items, dir);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify(out));
''')
        self.assertEqual(result, [{"id": "reversed", "measures": ["change", "growth"], "missing": ["change 12.4", "change 2.7", "growth -3.8", "growth 5.1"]}])


class MeasureEventTests(unittest.TestCase):
    def test_a_dated_event_on_a_measure_is_read_by_the_critic_and_drawn_on_the_chart(self):
        """A claim that faults fell after a switch was failed twice: the switch sat in a callout and a calculation, which the spine does not show."""
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { compileDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { measureProblems } from './skills/professional-slides/runtime/measures.mjs';
const FIX = 'evals/quality/fixtures/evidence';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-'));
fs.copyFileSync(path.join(FIX, 'explainer.insights.json'), path.join(dir, 'explainer.insights.json'));
const doc = JSON.parse(fs.readFileSync(path.join(FIX, 'explainer.pages.json'), 'utf8'));
const { spec } = compileDeck(doc, { insights: await readInsights(dir, 'explainer', {}), partial: true });
const quiet = structuredClone(doc); quiet.pages[1].exhibit.events = false;
const off = compileDeck(quiet, { insights: await readInsights(dir, 'explainer', {}), partial: true }).spec;
fs.rmSync(dir, { recursive: true, force: true });
const m = { unit: 'x', population: 'p', periods: ['2023 Q1', '2023 Q2'], values: [1, 2] };
console.log(JSON.stringify({ drawn: spec.slides.find((s) => s.id === 'x2').exhibit.events, off: off.slides.find((s) => s.id === 'x2').exhibit.events ?? null,
  stranger: measureProblems({ id: 'x', measures: { m: { ...m, events: { '2024 Q1': 'Not a period it records' } } } }).length,
  long: measureProblems({ id: 'x', measures: { m: { ...m, events: { '2023 Q2': 'a label that runs on for far too many words' } } } }).length,
  fine: measureProblems({ id: 'x', measures: { m: { ...m, events: { '2023 Q2': 'Switch to moving blocks' } } } }).length }));
''')
        self.assertEqual(result["drawn"], [{"at": "2023 Q3", "label": "Switch to moving blocks"}])
        self.assertIsNone(result["off"])
        self.assertEqual([result["stranger"], result["long"], result["fine"]], [1, 1, 0])


class SplitTableTests(unittest.TestCase):
    def test_a_table_too_long_for_one_page_is_refused_at_the_compile_naming_what_holds_it(self):
        """A lone table the composer cut across slides passed the compile and the check, and only the render refused it
        (TEXT_PLAN_PAGINATION): the content plan holds the page as one. The composer's own estimate says it first, and what
        holds the table on one page - the rows a page holds at the densest step, the author's `density` where it keeps the
        table from a step that fits, the page without its commentary, the halves."""
        result = run_node(WORKED + '''
const long = (which, n) => { const page = structuredClone(worked.pages.find((p) => `${p.type}/${p.form}` === which)); const rows = page.exhibit.rows;
  page.exhibit.rows = Array.from({ length: n }, (_, i) => rows[i % rows.length].map((cell, k) => (k === 0 ? `${typeof cell === 'string' ? cell : cell.text ?? 'Row'} ${i + 1}` : cell)));
  return page; };
const read = async (which, deck = {}) => { const page = long(which, 30);
  const run = await authorDeck(deckOf([page], deck), { baseDir: './skills/professional-slides/examples', fit: false });
  const all = [...run.blocking, ...run.advisories].filter((f) => f.id === page.id);
  return { codes: all.map((f) => f.code), split: all.filter((f) => f.code === 'PAGE_SPLITS').map((f) => [f.severity, f.class, f.measured, f.repair]), blocks: run.content.pages.find((p) => p.id === page.id).textPlan.length }; };
// A ranking of 18 stations its author pinned at body density, and one of 20 under a so-what bar: each would hold one page.
const stations = (n) => ({ heading: 'Journeys by station, FY26', columns: ['Station', 'Journeys, million', 'Growth FY23-FY26'],
  rows: Array.from({ length: n }, (_, i) => [`Station ${i + 1}`, String((60 - i * 1.3).toFixed(1)), `${40 - i}%`]) });
const lookup = worked.pages.find((p) => `${p.type}/${p.form}` === 'lookup/table');
const ways = async (page) => { const run = await authorDeck(deckOf([page]), { baseDir: './skills/professional-slides/examples', fit: false });
  return run.blocking.filter((f) => f.code === 'PAGE_SPLITS').map((f) => [f.measured, f.repair]); };
const pinned = await ways({ ...lookup, exhibit: { ...stations(18), density: 'body' } });
const barred = await ways({ ...lookup, commentary: 'so-what-bar', bar: worked.pages.find((p) => p.id === 'f-trend-column').bar, exhibit: stations(20) });
console.log(JSON.stringify({ heat: await read('scorecard/heatmap'), table: await read('lookup/table'), revision: await read('lookup/table', { workflow: 'existing_deck_revision' }), pinned, barred }));
''')
        for name in ("heat", "table", "revision"):
            page = result[name]
            self.assertNotIn("TEXT_PLAN_INCOMPLETE", page["codes"], name)
            self.assertGreater(page["blocks"], 60, name)                  # both parts' text reaches the content plan
            self.assertEqual(len(page["split"]), 1, name)
            severity, cls, measured, repair = page["split"][0]
            self.assertEqual([severity, cls, measured["slides"], measured["rows"], measured["density"]], ["blocker", "P", 2, 30, "dense"], name)
            self.assertIn(f"its table of 30 rows does not fit one page - set dense, its densest, a page holds {measured['holds']}", repair)
            self.assertIn("the render refuses the cut: the content plan holds the page as one (TEXT_PLAN_PAGINATION)", repair)
            self.assertIn(f"To hold one page, cut the table to {measured['holds']} rows or fewer", repair)
            self.assertLess(measured["holds"], 30, name)
        [(measured, repair)] = result["pinned"]
        self.assertEqual(measured["density"], "body")
        self.assertIn('or drop its `density: "body"`: set dense, all 18 rows fit', repair)
        self.assertIn('or set it in halves (`split: "halves"`), 9 rows a side', repair)
        [(measured, repair)] = result["barred"]
        self.assertIn('or drop the page\'s commentary (commentary "none"): the table takes the height and the width it held, and all 20 rows fit set dense', repair)


class EveryRefusalTests(unittest.TestCase):
    def test_a_page_with_two_defects_hears_both_in_one_compile(self):
        """A page's rules each returned their first refusal, so an axis that skips years, value labels turned off and a
        so-what bar left unwritten took three compiles to hear (the BA run); the runtime now breaks the axis itself. The
        other two are independent mends: said in one message, in the order the checks find them. Two tables stacked
        that are each too short are two reasons of one rule, asked past each other; and a page with nothing wrong but
        what the compile waives for a revision is not refused."""
        result = run_node(WORKED + '''
const page = structuredClone(worked.pages.find((p) => p.id === 'f-trend-column'));
delete page.exhibit.heading; delete page.exhibit.unit;
page.exhibit.dataLabels = false; page.bar = 'Too short';
const failed = (pages, deck = {}) => compileDeck(deckOf(pages, deck), { partial: true }).failed.map((f) => [f.stage ?? null, f.message]);
const short = (heading, columns) => ({ type: 'table', heading, columns, rows: [['North', '12'], ['South', '9']] });
const stacked = { ...worked.pages.find((p) => p.type === 'panels' && p.form === 'row'), form: 'stack', commentary: 'none', exhibit: undefined,
  exhibits: [short('Trains a day', ['Line', 'Trains']), short('Staff on shift', ['Depot', 'Staff'])] };
const labelsOff = structuredClone(worked.pages.find((p) => p.id === 'f-trend-column')); labelsOff.exhibit.dataLabels = false;
console.log(JSON.stringify({ two: failed([page]), stacked: failed([stacked]), waived: failed([labelsOff], { workflow: 'existing_deck_revision', rulesVersion: 2 }) }));
''')
        [[stage, message]] = result["two"]
        self.assertEqual(stage, "evidence")
        self.assertTrue(message.startswith("f-trend-column: the column switches its value labels off"), message)
        self.assertIn('. Also refused on this page, so mend it in the same edit: commentary "so-what-bar" closes the page on the implication', message)
        [[_, message]] = result["stacked"]
        self.assertIn(": TABLE_STACK - 2 tables are set one above another", message)
        self.assertIn("Also refused on this page, so mend it in the same edit: TABLE_TOO_SHORT - a table of 2 rows", message)
        self.assertEqual(result["waived"], [])


class HalvesTests(unittest.TestCase):
    def test_a_ranking_asked_for_in_halves_is_halved_and_a_table_that_cannot_be_is_refused_saying_why(self):
        """Twenty ranked cities with their points could be set neither as one table (it split across two slides) nor as two
        tables of ten (TABLE_PANELS_MERGE, which read the cities as measures and asked for a twenty-column table), and the
        halves layout was chosen only on a page with no commentary and no bar column. `split: "halves"` asks for it: the
        halves are set with the points in columns under them and a bar column drawn to one scale, a table that cannot be
        halved is refused with the reasons, and two tables that are one ranking cut in two are told to be one in halves."""
        result = run_node(WORKED + '''
const lookup = worked.pages.find((p) => `${p.type}/${p.form}` === 'lookup/table');
const below = worked.pages.find((p) => p.commentary === 'below' && (p.points || []).length >= 2);
const cities = ['Leeds', 'York', 'Hull', 'Bradford', 'Wakefield', 'Halifax', 'Harrogate', 'Skipton', 'Selby', 'Goole', 'Malton', 'Whitby', 'Ripon', 'Keighley', 'Ilkley', 'Otley', 'Batley', 'Dewsbury', 'Pontefract', 'Castleford'];
const ranked = (bar) => ({ heading: 'Journeys by station, FY26', columns: ['Station', bar ? { label: 'Journeys', unit: 'million', bar: true } : 'Journeys, million', 'Growth FY23-FY26'],
  rows: cities.map((city, i) => [city, (30 - i * 1.3).toFixed(1), `${20 - i}%`]) });
const page = (exhibit, extra = {}) => ({ ...lookup, commentary: 'below', points: below.points, exhibit, ...extra });
const tree = (node) => [node, ...(node?.items || []).flatMap(tree)];
const run = async (p) => { const done = await authorDeck(deckOf([p]), { baseDir: './skills/professional-slides/examples', fit: false });
  return { blocking: done.blocking.map((f) => `${f.code}: ${f.repair ?? f.message}`), layout: done.spec.slides[0]?.layout ?? null }; };
const halves = await run(page({ ...ranked(false), split: 'halves' }));
const barred = await run(page({ ...ranked(true), split: 'halves' }));
// The composed halves: two panels in reading order, the points in columns under them, one scale for the bars.
import { composeSlide } from './evals/support/compose.mjs';
const composed = tree({ items: composeSlide({ id: 's1', title: 'Leeds carries more journeys than the next three stations together', layout: 'table-halves', points: below.points, exhibit: { type: 'table', ...ranked(true), split: 'halves' } }, 0).items });
const panel = (suffix) => composed.find((node) => node.id === `s1-exhibit-${suffix}`).props;
const scaleOf = (props) => props.rows.map((row) => row.find((cell) => cell?.type === 'bars')?.scale);
const refused = async (p) => compileDeck(deckOf([p]), { partial: true }).failed.map((f) => f.message);
const twins = { ...lookup, type: 'panels', form: 'row', commentary: 'none', points: undefined, exhibit: undefined,
  exhibits: [{ type: 'table', ...ranked(false), rows: ranked(false).rows.slice(0, 10) }, { type: 'table', ...ranked(false), heading: undefined, rows: ranked(false).rows.slice(10) }] };
console.log(JSON.stringify({ halves, barred,
  panels: { a: panel('a').rows.map((row) => row[0]), b: panel('b').rows.map((row) => row[0]), scales: [...new Set([...scaleOf(panel('a')), ...scaleOf(panel('b'))])],
    same: JSON.stringify(panel('a').scales) === JSON.stringify(panel('b').scales), below: composed.some((node) => node.id === 's1-below') },
  wide: await refused(page({ ...lookup.exhibit, split: 'halves' })), beside: await refused(page({ ...ranked(false), split: 'halves' }, { commentary: 'beside' })),
  twins: await refused(twins) }));
''')
        for name in ("halves", "barred"):
            self.assertEqual(result[name], {"blocking": [], "layout": "table-halves"}, name)
        panels = result["panels"]
        self.assertEqual(panels["a"], ["Leeds", "York", "Hull", "Bradford", "Wakefield", "Halifax", "Harrogate", "Skipton", "Selby", "Goole"])
        self.assertEqual(panels["b"][0], "Malton")
        self.assertEqual(len(panels["scales"]), 1)
        self.assertTrue(panels["same"])
        self.assertTrue(panels["below"])
        [wide] = result["wide"]
        self.assertIn('the table cannot be set in halves (`split: "halves"`) - it has 6 columns, and two panels side by side hold 3 each', wide)
        self.assertIn("a cell runs to", wide)
        [beside] = result["beside"]
        self.assertIn('a table in halves takes the page\'s width, and commentary "beside" sets it beside a column', beside)
        [twins] = result["twins"]
        self.assertIn('TABLE_PANELS_MERGE - 2 tables on the page share the columns "Station | Journeys, million | Growth FY23-FY26" and run one ranking on: 20 members, ordered by "Journeys, million"', twins)
        self.assertIn('Set them as one table of the 20 rows with `split: "halves"`', twins)
        self.assertNotIn("the members as columns", twins)


if __name__ == "__main__":
    unittest.main()
