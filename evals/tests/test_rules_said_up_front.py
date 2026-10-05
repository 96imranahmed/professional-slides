"""Rules two real runs met only by breaking them: each cause mended, or the rule said before the page is written.

A chart heading refused for a member count, a model's designation and a
possessive year; a registry record named as a ledger read as a pointer to one;
a five-tile strip refused as "too short" with nothing an author could change;
a fact grid's `columns` refused by the composer in pixels; a token in a
timeline's sentence read as a measure the exhibit proves; a logo cell written
as the refusal says and still not read; and limits the page's `--limits` did
not print - the headers an implication column takes, what a table's typed
numbers ask, that a summary's ceiling counts its table, that tiles hold
different measures.
"""
from __future__ import annotations

import json
import unittest

from node_probe import ROOT, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
WORKED = '''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { authorDeck, compileDeck, readInsights, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
const worked = workedExamples();
const EXAMPLES = './skills/professional-slides/examples';
const pageOf = (which) => structuredClone(worked.pages.find((p) => `${p.type}/${p.form}` === which));
const deckOf = (pages, deck = {}) => ({ deck: { ...worked.deck, ...deck }, ...(worked.sources ? { sources: worked.sources } : {}), pages });
const own = (run, id) => [...run.blocking].filter((f) => f.id === id && !/^CONTENT_ANSWER|^VARIETY|^PAGE_SHAPE/.test(f.code)).map((f) => [f.code, String(f.repair ?? f.reason ?? '')]);
'''


class ChartHeadingTests(unittest.TestCase):
    def test_a_member_count_a_designation_and_a_possessive_year_are_not_results_and_results_still_are(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = { x: 72, y: 162, width: 1136, height: 431 };
const said = (heading) => { try { REGISTRY.get('chart.column').render({ id: 'c', frame, props: { heading, unit: 'units', categories: ['A', 'B', 'C', 'D'], series: [{ name: 's', values: [1, 2, 3, 4] }] } }); return null; } catch (error) { return error.message; } };
const names = ['Depots in service, 20 suppliers', "Regional museum visitors at 2025's growth rate", 'Model 505X in service with the supplier, assumed path', 'Lines open (12 markets)', 'Units of the X77 on order'];
const results = ['Visitors, 20 million', 'Visitors up 20 points', 'Growth of 12x since launch', 'Revenue, 5 pounds', 'Visitors: 2025', 'Visitors fell 20 halls', 'Stock, 500M'.replace('M', 'm')];
console.log(JSON.stringify({ names: names.map(said), results: results.map((heading) => (said(heading) ?? '').slice(0, 60)), message: said('Visitors up 20 points') }));
''')
        self.assertEqual(result["names"], [None] * 5)
        self.assertTrue(all(text.startswith("Chart title heading must not contain statistics") for text in result["results"]), result["results"])
        # The refusal lists what a heading may name, the three among it.
        for said in ('"at 2025\'s rate"', '"20 suppliers"', '"505X"'):
            self.assertIn(said, result["message"])


class SourceRecordTests(unittest.TestCase):
    def test_a_declared_record_named_as_a_ledger_is_the_source_named_and_a_pointer_to_a_ledger_is_still_refused(self):
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const sources = { ledger: { name: 'Official-source ledger supplied with the brief', short: 'Source ledger of the brief', status: 'company-reported' } };
const trend = { type: 'chart.line', categories: ['2020', '2021', '2022', '2023', '2024'], series: [{ name: 'Revenue', values: [1, 2, 3, 4, 5] }] };
const pages = (line) => [...Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, title: 'A finding on page ' + i, exhibit: trend, source: 'Source: Northvale Rail Annual Report 2025-26' })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: 'q' + i, title: 'Text page ' + i, source: i ? 'Source: Office of Rail Statistics, Feb 2026' : line }))];
const coded = (spec) => craftFindings(spec, { slides: [] }).filter((f) => f.code === 'CRAFT_SOURCE_CODES').map((f) => [f.severity, f.repair]);
console.log(JSON.stringify({
  declared: coded({ sources, slides: pages('Sources: Official-source ledger supplied with the brief (company-reported)') }),
  short: coded({ sources, slides: pages('Sources: Source ledger of the brief; Office of Rail Statistics') }),
  undeclared: coded({ slides: pages('Sources: Official-source ledger supplied with the brief (company-reported)') }),
  pointer: coded({ sources, slides: pages('Source: K26+DEP+RTE; exact URL in source ledger') }),
  both: coded({ sources, slides: pages('Sources: Official-source ledger supplied with the brief; see ledger') }) }));
''')
        self.assertEqual(result["declared"], [])
        self.assertEqual(result["short"], [])
        # The same words typed with no record behind them, and a pointer to a ledger with or without one, are still refused.
        for name in ("undeclared", "pointer", "both"):
            self.assertEqual([severity for severity, _ in result[name]], ["blocker"], name)
        self.assertIn("declaring it in the pages file's `sources` registry", result["pointer"][0][1])


class TileTests(unittest.TestCase):
    def test_a_strip_takes_the_height_its_tiles_need_and_says_what_to_change_where_it_cannot(self):
        result = run_node(WORKED + '''
const W = 'trains operated to the coast each weekday in the summer timetable under the new franchise terms agreed last year'.split(' ');
const tiles = (n, labelWords, subWords) => [['+20%', 'alpha'], ['90%', 'beta'], ['-7%', 'gamma'], ['14', 'delta'], ['3.2x', 'epsilon']].slice(0, n).map(([value, key]) => ({ value, label: `${key} ${W.slice(0, labelWords).join(' ')}`, sublabel: W.slice(0, subWords).join(' ') }));
// Five labels of different words, each a sentence long.
const LONG = ['Depots rebuilt along the northern corridor since the programme opened under the first franchise', 'Punctuality floor held through every winter month of the revised timetable for commuters',
  'Cost of each journey after electric units replaced the diesel fleet on branch services', 'Stations given step-free access and longer platforms during the second control period works',
  'Return earned on the maintenance facility once night servicing moved inside the regional boundary'];
const read = async (metrics, deck = {}) => { const page = pageOf('numbers/metric-strip'); page.metrics = metrics; return own(await authorDeck(deckOf([page], deck), { baseDir: EXAMPLES, fit: false }), page.id); };
console.log(JSON.stringify({ five: await read(tiles(5, 6, 10)), revision: await read(tiles(5, 6, 10), { workflow: 'existing_deck_revision' }), new: await read(tiles(5, 6, 10), { workflow: 'new_deck' }), wall: await read(LONG.map((label, at) => ({ value: ['+20%', '90%', '-7%', '14', '3.2x'][at], label, sublabel: `${W.join(' ')} ${W.join(' ')} ${W.join(' ')}` }))) }));
''')
        # Five tiles whose labels and sublabels wrap were refused as "too short for its value, label and delta".
        for name in ("five", "revision", "new"):
            self.assertEqual([code for code, _ in result[name] if code == "PAGE_DOES_NOT_COMPOSE"], [], name)
        [(code, repair)] = [entry for entry in result["wall"] if entry[0] == "PAGE_DOES_NOT_COMPOSE"]
        self.assertRegex(repair, r"A strip of 5 tiles gives each \d+px, and the tile \"[^\"]+\" needs \d+px for its value, label and sublabel where a strip grows to \d+px")
        self.assertIn("shorten its label or sublabel (or drop the sublabels), or set fewer tiles - 4 leave each", repair)

    def test_a_fact_grids_columns_are_refused_at_the_compile_and_published_and_tiles_are_said_to_hold_different_measures(self):
        result = run_node(WORKED + '''
import { pageLimits, deckLimits } from './skills/professional-slides/runtime/limits.mjs';
const wide = (deck) => { const page = pageOf('numbers/fact-grid'); const items = page.exhibit.items;
  page.exhibit.items = Array.from({ length: 5 }, (_, i) => ({ ...items[i % items.length], label: `${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][i]} ${items[i % items.length].label}` })); page.exhibit.columns = 5;
  const made = compileDeck(deckOf([page], deck), { partial: true }); return made.failed.map((f) => f.message); };
const limits = pageLimits('numbers', 'fact-grid');
console.log(JSON.stringify({ new: wide({ workflow: 'new_deck' }), revision: wide({ workflow: 'existing_deck_revision' }), columns: limits.exhibit.columns, tiles: limits.tiles, summary: deckLimits().executiveSummary }));
''')
        for name in ("new", "revision"):
            [message] = result[name]
            self.assertIn("a fact-grid's `columns` is how many tiles run across - a whole number from 1 to 4, and no more than its 5 items (got 5)", message)
            self.assertNotIn("px", message)
        self.assertEqual([result["columns"]["min"], result["columns"]["max"]], [1, 4])
        self.assertEqual(result["tiles"]["codes"], ["TILES_ONE_MEASURE", "SHARES_IN_TILES"])
        self.assertIn("one measure at two dates or for two members is plotted on one axis", result["tiles"]["note"])
        # The summary's ceiling is published with what it counts.
        self.assertIn("the cells of the summary's table as well as its points", result["summary"]["note"])
        self.assertEqual(result["summary"]["codes"], ["WORDS", "SPINE_UNFILLED"])


class TableRuleTests(unittest.TestCase):
    def test_the_headers_an_implication_column_takes_and_what_typed_numbers_ask_are_printed_with_the_limits(self):
        result = run_node(WORKED + '''
import { pageLimits } from './skills/professional-slides/runtime/limits.mjs';
import { INFERENCE_WORDS } from './skills/professional-slides/runtime/page-types.mjs';
const headed = (label) => { const page = pageOf('profiles/logo-table'); page.exhibit.columns = page.exhibit.columns.map((c) => (c && c.implication ? { ...c, label } : c));
  return compileDeck(deckOf([page]), { partial: true }).failed.map((f) => f.message); };
const limits = pageLimits('lookup', 'table');
console.log(JSON.stringify({ words: INFERENCE_WORDS, listed: limits.table.implicationColumn.headerHoldsOneOf, taken: INFERENCE_WORDS.map((word) => headed(`The ${word} for the supplier`).length),
  refused: headed('What it rests on'), numbers: limits.table.numbers }));
''')
        self.assertEqual(result["listed"], result["words"])
        self.assertEqual(result["taken"], [0] * len(result["words"]))           # every header the limits print is one the compile takes
        [refusal] = result["refused"]
        for word in result["words"]:
            self.assertIn(f'"{word}"', refusal)                                  # and the refusal lists them all
        self.assertEqual(result["numbers"]["codes"], ["BASIS_MISSING"])
        self.assertIn("a change or a share computed from recorded measures is an analysis", result["numbers"]["note"])


class TokenTests(unittest.TestCase):
    def test_a_token_in_an_exhibits_sentence_is_copy_and_a_token_in_a_cell_states_its_measure(self):
        result = run_node(WORKED + f'''
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const FIX = {json.dumps(str(FIXTURES))};
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tokens-'));
for (const name of ['finance.insights.json', 'finance.analysis.json']) await fs.copyFile(path.join(FIX, name), path.join(dir, name));
const finance = JSON.parse(await fs.readFile(path.join(FIX, 'finance.pages.json'), 'utf8'));
const insights = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }});
const TOKEN = '{{{{i-loans/loans@FY26 | 0}}}}';
// A timeline whose step says a recorded number in its sentence, on a page whose claim is about the order of events.
const timeline = pageOf('schedule/timeline');
Object.assign(timeline, {{ id: 'when', evidence: ['i-loans'], settles: {{ kind: 'sequence', what: 'the order in which the loan book was built' }} }});
timeline.exhibit.items[0].text = `The loan book stood at ${{TOKEN}} million when the programme began, before any of it was funded.`;
// The same number in a table's cell: the fixture's summary table prints it there, among words ("Up ...").
const read = async (deck) => {{ const run = await authorDeck({{ ...finance, deck: {{ ...finance.deck, ...deck }}, pages: [...finance.pages, timeline] }}, {{ baseDir: dir, insights, fit: false }});
  const slide = (id) => run.spec.slides.find((s) => s.id === id);
  return {{ codes: run.blocking.filter((f) => f.id === 'when').map((f) => f.code).filter((code) => /MEASURES|PROOF|BASIS|RELATION/.test(code)), printed: JSON.stringify(slide('when')?.exhibit?.items?.[0]?.text ?? '').includes('{{{{'),
    timeline: slide('when')?.pageType?.dependencies?.exhibits ?? null, cell: (slide('f0')?.pageType?.dependencies?.exhibits ?? []).some((ex) => (ex?.measures ?? []).includes('i-loans/loans')) }}; }};
const out = {{ new: await read({{}}), revision: await read({{ workflow: 'existing_deck_revision' }}) }};
await fs.rm(dir, {{ recursive: true, force: true }});
console.log(JSON.stringify(out));
''')
        for name in ("new", "revision"):
            page = result[name]
            self.assertEqual(page["codes"], [], name)                    # the sentence asks nothing of `settles.measures`
            self.assertFalse(page["printed"], name)                      # and its number is written from the record
            self.assertFalse([ex for ex in (page["timeline"] or []) if ex], name)   # the timeline is not an exhibit that shows the measure
            self.assertTrue(page["cell"], name)                          # a cell that prints it states it


class LogoCellTests(unittest.TestCase):
    def test_a_logo_cell_written_as_the_refusal_says_introduces_its_player(self):
        result = run_node(WORKED + '''
const players = ['Westmoor Trains', 'Tideway Rail', 'Northvale Rail'];
// The variety contract is read from twelve content pages on: the introduction first, then the worked deck's own pages.
const rest = worked.pages.filter((p) => p.type && !(p.type === 'profiles' && p.form === 'logo-table')).slice(0, 13);
const deck = (cell) => { const page = pageOf('profiles/logo-table');
  page.exhibit.rows = page.exhibit.rows.slice(0, 3).map((row, at) => [cell(players[at]), ...row.slice(1)]);
  const made = compileDeck(deckOf([page, ...structuredClone(rest)], { players: players.map((name) => ({ name })), assets: { fetch: 'none', reason: 'The build machine has no network access at all.' } }), { partial: true });
  return { failed: made.failed.map((f) => f.message), unmarked: made.findings.filter((f) => f.code === 'PLAYERS_UNMARKED').map((f) => [f.measured.unmarked, f.repair]) }; };
console.log(JSON.stringify({ player: deck((name) => ({ type: 'logo', player: name })), bare: deck((name) => ({ type: 'logo', player: `Another supplier ${name.length}` })) }));
''')
        self.assertEqual(result["player"]["unmarked"], [])
        # Cells that name other players leave these unmarked, and the refusal says to write that cell.
        [(unmarked, repair)] = result["bare"]["unmarked"]
        self.assertEqual(len(unmarked), 3)
        self.assertIn("Write each as a `logo` cell that names its `player`", repair)


if __name__ == "__main__":
    unittest.main()
