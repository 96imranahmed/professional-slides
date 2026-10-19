"""The fixes from the A350F rebuild's review (2026-10-19), each held to what went wrong.

The rebuild of the A350F deck at a hundred pages found the runtime summing payloads into a "Total" row, shading a
fleet table's last operator as a total, drawing four shares as a rising line, setting ranked bars in the order their
measure listed them, printing a unit twice, a stack's one part twice, a column's label off the slide, fetching a
flight-simulator cockpit as "the A350F", and reading airbus.com's body-text slate as its brand colour. The storyline
message showed unchecked figures as facts and miscounted the deck; research batches had to be merged by hand. Each
test below states one of those and holds the runtime to its fix. All run offline.
"""
import unittest

from node_probe import run_node


class TableFixTests(unittest.TestCase):
    def test_an_automatic_total_closes_only_a_table_of_one_unit(self):
        result = run_node('''
import { styleTable } from './evals/support/compose.mjs';
const specs = styleTable({ total: 'auto', columns: ['Freighter', { label: 'Payload', unit: 't' }, { label: 'Volume', unit: 'm3' }, { label: 'Range', unit: 'nm' }],
  rows: [['A350F', '111', '724', '4700'], ['777-8F', '118', '766', '5000'], ['777F', '107', '653', '4970']] });
const fleet = styleTable({ total: 'auto', columns: ['Line', { label: 'Journeys', unit: 'm' }, { label: 'Train-km', unit: 'm' }],
  rows: [['Eastern', '14.2', '3.1'], ['Dales', '9.8', '2.2'], ['Valley', '8.1', '1.9']] });
console.log(JSON.stringify({ specsLast: specs.rows.at(-1), fleetLast: fleet.rows.at(-1) }));
''')
        self.assertNotEqual(result["specsLast"].get("style") if isinstance(result["specsLast"], dict) else None, "total")
        self.assertEqual(result["fleetLast"]["style"], "total")

    def test_a_last_row_smaller_than_a_part_above_is_not_read_as_their_total(self):
        result = run_node('''
import { inferredTreatments } from './skills/professional-slides/runtime/compose-tables.mjs';
const rows = [['FedEx', 56, 0, 29, 0, 85], ['Atlas', 18, 56, 0, 0, 74], ['UPS', 0, 43, 0, 0, 43], ['Kalitta', 8, 22, 0, 7, 37],
  ['Qatar', 29, 0, 0, 0, 29], ['AeroLogic', 28, 0, 0, 0, 28], ['Singapore', 5, 7, 0, 0, 12]];
const out = inferredTreatments({ columns: ['Operator', '777F', '747s', 'MD-11F', '777-300ERSF', 'All'], rows });
console.log(JSON.stringify({ last: out.rows.at(-1) }));
''')
        self.assertIsInstance(result["last"], list, "Singapore's row is a row, not a total")


class ChartFixTests(unittest.TestCase):
    def test_a_trend_over_members_is_refused_and_period_labels_are_read_as_periods(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { isPeriodLabel } from './skills/professional-slides/runtime/time-axis.mjs';
const page = (categories) => ({ id: 'p', type: 'trend', form: 'column', title: 'E-commerce is a fifth of air cargo', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading: 'E-commerce share', unit: '%', categories, series: [{ name: 'Share', values: categories.map((_, i) => 10 + i * 5) }] } });
let refused = null;
try { compilePage(page(['International air cargo, 2025', 'Worldwide air freight, 2024', 'China to US, 2024'])); } catch (e) { refused = e.message; }
compilePage(page(['End 2021', 'End 2022', 'End 2023']));
console.log(JSON.stringify({ refused, labels: ['End 2021', '30 Sep 2026', 'Before 1995', '2015 or later', '2026 YTD Mar', 'Today', 'Large widebody (80 t+)'].map(isPeriodLabel) }));
''')
        self.assertTrue(result["refused"].startswith("TREND_NOT_TIME"))
        self.assertEqual(result["labels"], [True, True, True, True, True, True, False])

    def test_a_ranking_is_set_largest_first_unless_its_order_is_given(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = (more = {}) => ({ id: 'p', type: 'ranking', form: 'bar', title: 'Asia-North America carries the most', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading: 'Share of lanes', unit: '%', categories: ['Europe-Asia', 'Within Asia', 'Asia-North America', 'Within Europe'], series: [{ name: 'Share', values: [21.5, 7.4, 23.4, 1.9] }],
    categoryNotes: ['a', 'b', 'c', 'd'], ...more } });
const ex = (slide) => slide.exhibit ?? slide.exhibits?.[0];
const sorted = ex(compilePage(page())), given = ex(compilePage(page({ order: 'given' })));
console.log(JSON.stringify({ sorted: sorted.categories, notes: sorted.categoryNotes, given: given.categories }));
''')
        self.assertEqual(result["sorted"], ["Asia-North America", "Europe-Asia", "Within Asia", "Within Europe"])
        self.assertEqual(result["notes"], ["c", "a", "b", "d"])
        self.assertEqual(result["given"], ["Europe-Asia", "Within Asia", "Asia-North America", "Within Europe"])

    def test_a_heading_that_repeats_its_unit_is_refused_and_a_measure_named_by_its_unit_is_not(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = (heading, unit) => ({ id: 'p', type: 'ranking', form: 'bar', title: 'The A350F burns a fifth less', commentary: 'on-exhibit', source: 'Source: test',
  exhibit: { heading, unit, categories: ['A350F', '777-8F', '777F'], series: [{ name: 'Fuel', values: [80, 93, 100] }] } });
let refused = null;
try { compilePage(page('Fuel burn for the same job, 777F = 100', 'index (777F = 100)')); } catch (e) { refused = e.message; }
compilePage(page('Eastern line peak trains per hour', 'trains'));
console.log(JSON.stringify({ refused }));
''')
        self.assertTrue(result["refused"].startswith("HEADING_REPEATS_UNIT"))

    def test_a_stack_of_one_part_prints_no_total_over_it(self):
        result = run_node('''
import { withStackTotals } from './skills/professional-slides/runtime/compose-exhibits.mjs';
const ex = withStackTotals({ type: 'chart.stacked-column', categories: ['2027', '2033', '2034'], series: [{ name: 'Firm', values: [4, 21, 0] }, { name: 'Further', values: [0, 3, 15] }] });
console.log(JSON.stringify({ totals: ex.stackTotals }));
''')
        self.assertEqual(result["totals"], [{"category": "2033", "value": 24}])


class StorylineFixTests(unittest.TestCase):
    STORYLINE = '''
const storyline = { question: 'How much upside?', answer: '264-330 aircraft, $45-57bn', alternative: '10 pages',
  reader: { audience: 'executives', readerKnows: 'aviation', decision: 'size it', density: 'executive' },
  sections: [
    { role: 'opening', pages: [{ id: 'exec', title: 'Executive summary', type: 'summary/executive-summary' }] },
    { role: 'finding', name: 'Demand', claim: 'Demand is large', pages: [
      { id: 'forecast', title: '660 new large freighters to 2043', type: 'composition/stacked-bar', compares: 'deliveries by class', members: 3, series: 2, candidates: ['composition/stacked-bar'], data: { status: 'found', what: 'Boeing WACF' } },
      { id: 'pair', title: 'The A350F burns 20% less', type: 'ranking/bar', compares: 'two types', members: 2, candidates: ['ranking/bar'], data: { status: 'to-find', what: 'claims' } }] },
    { role: 'finding', name: 'Traction', claim: 'Customers choose it', pages: [
      { id: 'orders', title: 'Orders by type', type: 'trend/line', compares: 'orders by year', members: 6, candidates: ['trend/stacked-column', 'trend/line'], data: { status: 'to-find', what: 'O&D' } }] },
    { role: 'appendix', pages: [{ id: 'glossary', title: 'Glossary', type: 'lookup/table', compares: 'terms', data: { status: 'found', what: 'definitions' } }] }] };
'''

    def test_the_message_marks_unchecked_pages_counts_the_pages_the_build_adds_and_names_a_skipped_candidate(self):
        result = run_node(self.STORYLINE + '''
import { approvalMessage, shortPages } from './skills/professional-slides/runtime/public/storyline.mjs';
console.log(JSON.stringify({ withContents: approvalMessage(storyline, { contents: 'once' }), without: approvalMessage(storyline, { contents: false }), short: shortPages(storyline).map((f) => f.id) }));
''')
        self.assertIn("The build adds the cover, a contents page, 2 section dividers and an appendix divider: 10 pages in all, 11 if the deck carries photographs", result["withContents"])
        self.assertIn("The build adds the cover and an appendix divider: 7 pages in all", result["without"])
        self.assertRegex(result["withContents"], r"\n\s+3\* The A350F burns 20% less")
        self.assertIn("not its first candidate, trend/stacked-column", result["withContents"])
        self.assertIn("* The data behind this page is still to find", result["withContents"])
        self.assertEqual(result["short"], ["pair"])

    def test_advisories_put_a_changed_title_first_and_typed_numbers_in_one_line(self):
        result = run_node('''
import { rankedAdvisories } from './skills/professional-slides/runtime/public/workspace.mjs';
const out = rankedAdvisories([{ code: 'NUMBER_UNTRACED', id: 'a' }, { code: 'SCENE_DENSE', id: 'b' }, { code: 'NUMBER_UNTRACED', id: 'c' },
  { code: 'NUMBERS_DISAGREE', id: 'd' }, { code: 'STORYLINE_TITLE_CHANGED', id: 'e' }]);
console.log(JSON.stringify({ codes: out.map((f) => f.code), pages: out.at(-1).pages }));
''')
        self.assertEqual(result["codes"], ["STORYLINE_TITLE_CHANGED", "NUMBERS_DISAGREE", "SCENE_DENSE", "NUMBER_UNTRACED"])
        self.assertEqual(result["pages"], ["a", "c"])


class PictureFixTests(unittest.TestCase):
    def test_a_file_is_taken_only_where_it_names_what_the_search_asks_for(self):
        result = run_node('''
import { relevance, searchTerms, namedCandidates } from './skills/professional-slides/runtime/picture-providers.mjs';
const files = [{ title: "File:A350-900 full flight simulator cockpit VHHH.jpg" }, { title: "File:A350-900 d'Edelweiss Air.jpg" },
  { title: 'File:Qatar Airways, A7-ANI, Airbus A350-1041 (49588621913).jpg' }];
console.log(JSON.stringify({
  terms: searchTerms('Airbus A350F first flight 2026'),
  a350f: namedCandidates(files, 'Airbus A350F').map((f) => f.title),
  a7ani: namedCandidates(files, 'Qatar Airways A7-ANI Airbus A350-1041').map((f) => f.title),
  spaced: relevance('Boeing 777 8F rollout', 'Boeing 777-8F').named,
  generic: relevance('Cargo Loading (8336053)', 'air cargo loading').named,
}));
''')
        self.assertEqual(result["terms"]["identity"], ["a350f"], "a model is identifying; a year is not")
        self.assertEqual(result["a350f"], [], "no A350-900, and no simulator, is the A350F")
        self.assertEqual(result["a7ani"], ["File:Qatar Airways, A7-ANI, Airbus A350-1041 (49588621913).jpg"])
        self.assertTrue(result["spaced"])
        self.assertTrue(result["generic"])

    def test_the_libraries_are_searched_in_order_and_the_next_only_when_the_last_named_nothing(self):
        result = run_node('''
import { searchLibraries } from './skills/professional-slides/runtime/picture-providers.mjs';
const requests = [];
const fetch = async (url) => { requests.push(new URL(url).host); return { ok: true, json: async () => ({ results: [
  { title: 'Air cargo pallets', creator: 'A. Photographer', license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/',
    foreign_landing_url: 'https://flickr.com/x', url: 'https://live.staticflickr.com/x.jpg', width: 2048, height: 1365, tags: [{ name: 'air cargo' }, { name: 'pallets' }], filetype: 'jpg' }] }) }; };
const commons = async () => [{ title: 'File:Sea freight.jpg', text: 'Sea freight container ship' }];
const found = await searchLibraries('air cargo pallets', { commons, fetch, keys: {} });
const first = await searchLibraries('air cargo pallets', { commons: async () => [{ title: 'File:Air cargo pallets.jpg', text: 'Air cargo pallets' }], fetch, keys: {} });
console.log(JSON.stringify({ provider: found[0]?.provider, credit: found[0]?.credit, tried: found.tried, requests, firstTried: first.tried }));
''')
        self.assertEqual(result["provider"], "openverse")
        self.assertEqual(result["credit"], "Photo: A. Photographer, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/), via Openverse: https://flickr.com/x")
        self.assertEqual(result["tried"], ["commons", "openverse"])
        self.assertEqual(result["firstTried"], ["commons"], "a search Commons answers costs one request")

    def test_a_key_is_read_from_its_variable_first_and_the_keys_file_is_the_users_alone(self):
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pictureKeys, setPictureKey, keysPath, keyStatus } from './skills/professional-slides/runtime/picture-keys.mjs';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-keys-'));
const env = { PROFESSIONAL_SLIDES_HOME: home };
setPictureKey('pexels', 'from-file', env);
setPictureKey('unsplash', 'from-file-too', env);
const both = pictureKeys({ ...env, PEXELS_API_KEY: 'from-env' });
console.log(JSON.stringify({ pexels: both.pexels, unsplash: both.unsplash.from, status: keyStatus(env), mode: (fs.statSync(keysPath(env)).mode & 0o777).toString(8) }));
''')
        self.assertEqual(result["pexels"], {"key": "from-env", "from": "environment"})
        self.assertEqual(result["unsplash"], "keys file")
        self.assertEqual(result["status"], {"pexels": "keys file", "unsplash": "keys file", "pixabay": None})
        self.assertEqual(result["mode"], "600")

    def test_a_compare_sides_picture_composes_once_embedded_and_a_bare_path_is_refused_in_words(self):
        result = run_node('''
import { imageProps } from './skills/professional-slides/runtime/compose-pictures.mjs';
const embedded = imageProps({ dataUri: 'data:image/jpeg;base64,AAAA', width: 10, height: 5, alt: 'An A350-1000', authorization: 'Photo: x, CC BY 2.0' }, '/deck');
let refused = null;
try { imageProps('assets/pictures/a.jpg', '/deck'); } catch (e) { refused = e.message; }
console.log(JSON.stringify({ embedded, refused }));
''')
        self.assertEqual(result["embedded"]["authorization"], "Photo: x, CC BY 2.0")
        self.assertIn("a picture is { path, alt, credit }", result["refused"])


class StyleFixTests(unittest.TestCase):
    def test_a_colour_the_site_names_for_its_brand_outranks_a_frequent_slate(self):
        result = run_node('''
import { siteDesign } from './skills/professional-slides/runtime/site-design.mjs';
const css = [':root { --awx-color-primary-blue-90: #00205B; --awx-color-primary-blue-50: #255FCC; }',
  ...Array.from({ length: 20 }, () => 'p { color: #2B333F } .x { border-color: #2B333F }')].join('\\n');
console.log(JSON.stringify(siteDesign([css]).brand));
''')
        self.assertEqual(result, {"primary": "#00205B", "accent": "#255FCC"})


if __name__ == "__main__":
    unittest.main()
