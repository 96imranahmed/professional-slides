"""The design findings of one audit of a fifty-page deck, each fixed where the
page is made.

- Pages were emptier than strong decks: flows floated in their frames, a
  commentary rail ended halfway down beside a full-height chart, and an
  executive summary ran four findings across the body at 160 characters a line.
- Charts took the wrong form: dots coloured by series with no key, a time
  series and formula curves drawn as loose dots.
- Figures were set in boxes: one-column fact grids of 1160px tiles, a strip
  repeating what its chart printed, one measure at two dates in two tiles.
- Recognisable players were plain text in their own columns and verdicts, and
  the cover showed none of them.
- Tables drew a chevron before any last column, status colours on names, and
  hung one-line values from the top beside a centred label block.
- Chart craft: four saturated series, ISO month ticks, a donut keyed from the
  top, captions set as centred bold boxes, arrow labels struck through by their
  arrows, display-serif numerals descending into a rule.
- Type: a chart's mark count set the whole page's prose a size smaller.
- Cover, divider and closing: a small low cover title, sections numbered three
  ways, closing messages set wholly in bold.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from node_probe import run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
RUNTIME = "./skills/professional-slides/runtime"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

DECK = """
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const build=(slides, extra={})=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides,...extra},'.')).deck;
"""


class EmptySpaceTests(unittest.TestCase):
    def test_a_flow_starts_at_the_top_of_its_frame_and_grows_to_fill_it(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const props = {{ nodes: [{{ id: 'a', label: 'Customer sale', text: '$100 billed' }}, {{ id: 'b', label: 'Gross basis', text: '$100 revenue' }},
  {{ id: 'c', label: 'Net basis', text: '$85 revenue' }}, {{ id: 'd', label: 'Pre-compute cash', text: '$85 either way' }}],
  edges: [{{ from: 'a', to: 'b', label: 'principal role' }}, {{ from: 'a', to: 'c', label: 'agent role' }}, {{ from: 'b', to: 'd' }}, {{ from: 'c', to: 'd' }}] }};
const frame = {{ x: 60, y: 150, width: 780, height: 470 }};
const nodes = REGISTRY.get('flow').render({{ id: 'f', frame, props }}).nodes;
const steps = nodes.filter((n) => n.role === 'flow-step').map((n) => n.frame);
const arrows = nodes.filter((n) => n.role === 'flow-arrow').map((n) => n.data);
const labels = nodes.filter((n) => n.role === 'flow-arrow-label').map((n) => n.frame);
const natural = REGISTRY.get('flow').measureContent({{ frame, props }}).natural;
const crosses = (b, l) => {{ for (let i = 0; i <= 200; i++) {{ const x = l.x1 + (l.x2 - l.x1) * i / 200, y = l.y1 + (l.y2 - l.y1) * i / 200;
  if (x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height) return true; }} return false; }};
const meets = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
console.log(JSON.stringify({{ top: Math.min(...steps.map((s) => s.y)), bottom: Math.max(...steps.map((s) => s.y + s.height)), natural,
  struck: labels.some((b) => arrows.some((l) => crosses(b, l))), onStep: labels.some((b) => steps.some((s) => meets(b, s))),
  apart: !meets(labels[0], labels[1]) }}));
""")
        self.assertEqual(result["top"], 150)
        # Two rows of steps take most of a 470px frame, not a strip of it.
        self.assertGreater(result["bottom"] - 150, 0.7 * 470)
        self.assertFalse(result["struck"], "an arrow runs through its label")
        self.assertFalse(result["onStep"], "a label touches a step")
        self.assertTrue(result["apart"])

    def test_a_short_commentary_column_goes_under_a_chart_its_page_type_placed_beside(self):
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
import {{ composeSlide }} from '{RUNTIME}/compose.mjs';
{PAGE}
const exhibit = {{ heading: 'Contribution after costs', unit: '$', categories: ['2019', '2020', '2021', '2022', '2023', '2024'],
  series: [{{ name: 'Firm A', values: [3, 5, 8, 9, 12, 15] }}, {{ name: 'Firm B', values: [4, 5, 6, 7, 7, 8] }}], highlights: [{{ category: '2024' }}] }};
const page = (points) => ({{ ...base, id: 'p1', type: 'trend', form: 'line', commentary: 'beside', title: 'Firm A pulled ahead of Firm B after 2021',
  exhibit, points, highlight: points.map((p) => p.split(' ')[0]) }});
const ids = (slide) => {{ const out = []; const walk = (item) => {{ out.push(String(item.id || '')); (item.items || []).forEach(walk); }}; slide.items.forEach(walk); return out; }};
const short = ids(composeSlide(compilePage(page(['Contribution rose every year.', 'Costs fell faster than prices.']), 0), 0));
const byHand = ids(composeSlide({{ id: 'p1', title: 'A hand-written page keeps its column', layout: 'exhibit-left', exhibit: {{ type: 'chart.line', ...exhibit }}, points: ['Contribution rose every year.', 'Costs fell faster than prices.'] }}, 0));
console.log(JSON.stringify({{ short: {{ side: short.some((i) => i.endsWith('-side')), below: short.some((i) => i.endsWith('-below')) }}, byHand: byHand.some((i) => i.endsWith('-side')) }}));
""")
        self.assertEqual(result["short"], {"side": False, "below": True})
        self.assertTrue(result["byHand"])

    def test_four_developed_summary_points_run_as_a_ledger_at_a_reading_measure(self):
        # Two by two, the pairs centred in each half of the body left a band of
        # air a third of the page tall between them; one finding a row, the
        # lead beside its statement, reads down the body in order.
        result = run_node(DECK + """
const text = (i) => `Finding ${i} is developed across a full sentence of evidence, with the number that proves it and the qualification that bounds it for the reader.`;
const deck = build([{ id: 's', title: 'The answer and its proof', layout: 'text', points: [1, 2, 3, 4].map((i) => ({ lead: `Lead ${i}`, text: text(i) })) }]);
const items = deck.slides[0].nodes.filter((n) => n.role === 'list-item');
const leads = deck.slides[0].nodes.filter((n) => n.role === 'list-lead');
console.log(JSON.stringify({ xs: [...new Set(items.map((n) => Math.round(n.frame.x)))].length, ys: [...new Set(items.map((n) => Math.round(n.frame.y)))].length,
  widest: Math.max(...items.map((n) => n.frame.width)), beside: leads.every((l) => l.frame.x + l.frame.width < Math.min(...items.map((n) => n.frame.x))) }));
""")
        self.assertEqual(result["xs"], 1)
        self.assertEqual(result["ys"], 4)
        self.assertTrue(result["beside"])
        self.assertLess(result["widest"], 600)


class ChartFormTests(unittest.TestCase):
    def test_a_scatter_coloured_by_series_is_keyed_or_refused(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ toDeckPlan }} from '{RUNTIME}/compose.mjs';
import {{ planDeck }} from '{RUNTIME}/planner.mjs';
{PAGE}
const points = [['a', 1, 3, 'East'], ['b', 2, 5, 'East'], ['c', 3, 2, 'West'], ['d', 4, 6, 'West'], ['e', 5, 4, 'East']].map(([name, x, y, series]) => ({{ name, x, y, series }}));
const deck = planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', tracker: false, slides: [{{ id: 's', title: 'Two regions sit apart', layout: 'exhibit-full', exhibit: {{ type: 'chart.scatter', heading: 'Cost and margin', points }} }}] }}, '.')).deck;
const frame = {{ x: 0, y: 0, width: 800, height: 420 }};
const render = (props) => REGISTRY.get('chart.scatter').render({{ id: 'c', frame, props: {{ annotations: [], highlights: [], referenceLines: [], ...props }} }}).nodes;
const connected = render({{ points, legend: false, connect: true, referenceLines: [{{ value: 4, label: 'Break-even' }}] }});
console.log(JSON.stringify({{ legend: deck.slides[0].nodes.filter((n) => n.role === 'legend-label').map((n) => n.text),
  unkeyed: error(() => render({{ points, legend: false }})),
  lines: connected.filter((n) => n.role === 'chart-line').length, ends: connected.filter((n) => n.data?.labelKind === 'series-end').map((n) => n.text),
  reference: connected.filter((n) => n.role === 'chart-reference-line').length }}));
""")
        self.assertEqual(sorted(result["legend"]), ["East", "West"])
        self.assertIn("names none of them", result["unkeyed"])
        self.assertEqual(result["lines"], 3)
        self.assertEqual(sorted(result["ends"]), ["East", "West"])
        self.assertGreaterEqual(result["reference"], 1)

    def test_dots_over_time_and_formula_curves_are_refused_at_compile(self):
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const scatter = (exhibit) => ({{ ...base, id: 'p1', type: 'relationship', form: 'scatter', commentary: 'on-exhibit', title: 'The hurdle falls as contribution per task rises',
  exhibit: {{ heading: 'Hurdle', annotations: [{{ category: 'p3', text: 'At equal contribution the hurdle is half of all the paid tasks' }}], ...exhibit }} }});
const curve = [0.2, 0.5, 1, 1.5, 2, 3, 4, 5].map((x, i) => ({{ name: 'p' + i, x, y: Math.round(100 / (1 + x)) }}));
const cloud = [[1, 5], [2, 3], [3, 6], [4, 2], [5, 7], [6, 4], [7, 6], [8, 3]].map(([x, y], i) => ({{ name: 'p' + i, x, y }}));
console.log(JSON.stringify({{
  time: error(() => compilePage(scatter({{ xLabel: 'Months since Jan 2025', points: cloud }}))),
  curve: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: curve }}))),
  joined: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: curve, connect: true, referenceLines: [{{ value: 50, label: 'Equal share' }}] }}))),
  cloud: error(() => compilePage(scatter({{ xLabel: 'Contribution ratio', points: cloud }}))),
}}));
""")
        self.assertIn("trend drawn without its line", result["time"])
        self.assertIn("connect: true", result["curve"])
        for key in ("joined", "cloud"):
            self.assertNotIn("connect: true", result[key] or "")
            self.assertNotIn("without its line", result[key] or "")

    def test_value_labels_switched_off_on_a_few_marks_are_refused(self):
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const trend = (extra) => ({{ ...base, id: 'p1', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Revenue rose in every year of the run',
  exhibit: {{ heading: 'Revenue, $B', categories: ['2021', '2022', '2023', '2024'], series: [{{ name: 'A', values: [1, 2, 3, 4] }}, {{ name: 'B', values: [2, 2, 3, 3] }}],
    annotations: [{{ category: '2022', text: 'The launch year doubled revenue as the new product reached every region' }}], ...extra }} }});
console.log(JSON.stringify({{ off: error(() => compilePage(trend({{ dataLabels: false }}))), gridded: error(() => compilePage(trend({{ dataLabels: false, gridlines: true }}))) }}));
""")
        self.assertIn("nothing to read a value by", result["off"])
        self.assertNotIn("nothing to read a value by", result["gridded"] or "")


class NumberCardTests(unittest.TestCase):
    def test_a_one_column_fact_grid_needs_its_sentences_and_never_stretches(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ compilePage }} from '{KIT}';
{PAGE}
const grid = REGISTRY.get('fact-grid');
const frame = {{ x: 0, y: 0, width: 1160, height: 440 }};
const items = [{{ value: '25.8%', label: 'Jan cohort retained' }}, {{ value: '45%', label: 'Feb cohort retained' }}, {{ value: '14pp', label: 'Gap to the leader' }}];
const told = items.map((item) => ({{ ...item, text: 'A sentence that says what the figure counts and why it matters here' }}));
const tiles = grid.render({{ id: 'g', frame, props: {{ items: told, columns: 1 }} }}).nodes.filter((n) => n.role === 'fact-tile');
const across = grid.render({{ id: 'g', frame, props: {{ items }} }}).nodes.filter((n) => n.role === 'fact-tile');
const value = grid.render({{ id: 'g', frame, props: {{ items }} }}).nodes.find((n) => n.role === 'fact-value');
const bare = grid.render({{ id: 'g', frame, props: {{ items, columns: 1 }} }}).nodes.filter((n) => n.role === 'fact-tile');
const page = (exhibit) => ({{ ...base, id: 'p1', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Three facts set the scale of the business', exhibit }});
console.log(JSON.stringify({{ compiled: error(() => compilePage(page({{ items, columns: 1 }}))), toldCompiles: error(() => compilePage(page({{ items: told, columns: 1 }}))),
  bare: new Set(bare.map((t) => t.frame.y)).size,
  told: Math.max(...tiles.map((t) => t.frame.y + t.frame.height)), across: across.length && new Set(across.map((t) => t.frame.y)).size, face: value.style.fontFamily.tokenId }}));
""")
        self.assertIn("give every tile its sentence", result["compiled"])
        self.assertNotIn("give every tile its sentence", result["toldCompiles"] or "")
        self.assertEqual(result["bare"], 1, "a one-column grid compiled before the refusal draws its facts across")
        self.assertLess(result["told"], 440, "a one-column grid keeps its natural height")
        self.assertEqual(result["across"], 1)
        self.assertEqual(result["face"], "font.body", "figures are set in the body face, whose digits line up")

    def test_one_measure_in_two_tiles_and_a_strip_repeating_its_chart_are_refused(self):
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
{PAGE}
const facts = (items) => ({{ ...base, id: 'p1', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Claude retention improved over the year', exhibit: {{ items }} }});
const strip = (metrics) => ({{ ...base, id: 'p2', type: 'numbers', form: 'metric-strip', commentary: 'none', title: 'OpenAI pace rose through the year', metrics,
  exhibit: {{ type: 'chart.column', heading: 'Pace, $B', categories: ['2023', '2024', '2025', 'Mar 2026', 'Aug 2026'], series: [{{ name: 'Pace', values: [2, 6, 20, 24, 40] }}] }} }});
console.log(JSON.stringify({{
  dates: error(() => compilePage(facts([{{ value: '25.8%', label: 'Claude Jan 2025 cohort retained at six months' }}, {{ value: '45%', label: 'Claude Feb 2026 cohort retained at six months' }}, {{ value: '14pp', label: 'Gap to ChatGPT, latest' }}]))),
  distinct: error(() => compilePage(facts([{{ value: '$1B', label: 'Ads annualized run rate' }}, {{ value: '<200d', label: 'Time from launch to the milestone' }}, {{ value: '>1B', label: 'Weekly ChatGPT users' }}]))),
  repeated: error(() => compilePage(strip([{{ value: '~$2B', label: '2023 pace' }}, {{ value: '~$24B', label: 'March 2026 pace' }}, {{ value: '>$40B', label: 'August 2026 report' }}]))),
  added: error(() => compilePage(strip([{{ value: '12x', label: 'Growth, 2023 to March 2026' }}, {{ value: '+$16B', label: 'Added March to August' }}, {{ value: '2x', label: 'Over the 2025 pace' }}]))),
}}));
""")
        self.assertIn("one measure at two dates", result["dates"])
        self.assertNotIn("one measure at two dates", result["distinct"] or "")
        self.assertIn("the strip repeats", result["repeated"])
        self.assertNotIn("the strip repeats", result["added"] or "")


class IdentityAndTableTests(unittest.TestCase):
    def test_players_mark_their_columns_and_verdicts_and_colour_stays_for_states(self):
        result = run_node(f"""
import {{ compilePage, markPlayerCells }} from '{KIT}';
{PAGE}
const slide = {{ exhibit: {{ type: 'table', columns: [{{ label: 'Route', type: 'category' }}, 'Anthropic result', 'OpenAI result', 'Edge'],
  rows: [['Reach', 'x', 'y', {{ type: 'rag', text: 'OpenAI leads', value: 'won' }}], ['Paid', 'x', 'y', 'Anthropic ahead'], ['Cash', 'x', 'y', 'Split']] }} }};
markPlayerCells(slide, [{{ name: 'Anthropic' }}, {{ name: 'OpenAI' }}]);
const table = (columns, cells) => ({{ ...base, id: 'p1', type: 'lookup', form: 'table', commentary: 'in-exhibit', title: 'The routes split between the two firms on reach and pay',
  exhibit: {{ columns, rows: [['Reach', 'a', cells[0]], ['Paid', 'b', cells[1]], ['Cash', 'c', cells[2]]] }} }});
console.log(JSON.stringify({{ columns: slide.exhibit.columns.map((c) => c.logo?.alt ?? null), edge: slide.exhibit.rows.map((r) => r[3]),
  gutter: error(() => compilePage(table(['Route', 'Evidence', {{ label: 'Conversion known?', implication: true }}], ['yes', 'no', 'no']))),
  inferred: error(() => compilePage(table(['Route', 'Evidence', {{ label: 'Implication', implication: true }}], ['Scale it', 'Hold', 'Test']))),
  amber: error(() => compilePage(table(['Route', 'Evidence', {{ label: 'Status', type: 'rag' }}], [{{ type: 'rag', value: 'on-track', text: 'On track' }}, {{ type: 'rag', value: 'behind', text: 'Split' }}, {{ type: 'rag', value: 'at-risk', text: 'At risk' }}]))),
}}));
""")
        self.assertEqual(result["columns"], [None, "Anthropic logo", "OpenAI logo", None])
        self.assertEqual(result["edge"][0]["type"], "logo")
        self.assertEqual(result["edge"][0]["text"], "OpenAI leads")
        self.assertEqual(result["edge"][1]["player"], "Anthropic")
        self.assertEqual(result["edge"][2], "Split")
        self.assertIn("names another fact", result["gutter"])
        self.assertNotIn("names another fact", result["inferred"] or "")
        self.assertIn('value: "neutral"', result["amber"])

    def test_a_row_led_by_a_filled_label_centres_its_values(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const props = {{ treatment: 'categories', columns: [{{ label: 'Route', type: 'category' }}, 'Evidence', 'Limit'],
  rows: [['Consumer', 'One line', 'A limit that runs long enough to wrap onto a second and a third line in its narrow column'], ['Business', 'One line', 'Short']],
  columnWidths: [0.25, 0.5, 0.25] }};
const nodes = REGISTRY.get('table').render({{ id: 't', frame: {{ x: 0, y: 0, width: 800, height: 400 }}, props }}).nodes;
const cells = nodes.filter((n) => n.role === 'table-cell-text' && n.data.row === 0);
const band = nodes.find((n) => n.role === 'table-cell' && n.data.row === 0 && n.data.column === 0);
const oneLine = cells.find((n) => n.data.column === 1);
console.log(JSON.stringify({{ centre: oneLine.frame.y + oneLine.frame.height / 2, band: band.frame.y + band.frame.height / 2 }}));
""")
        self.assertAlmostEqual(result["centre"], result["band"], delta=3)


class ChartCraftTests(unittest.TestCase):
    def test_a_title_naming_one_of_several_series_greys_the_rest(self):
        result = run_node(DECK + """
const deck = build([{ id: 's', title: 'Enterprise spend shifted toward Anthropic', layout: 'exhibit-full',
  exhibit: { type: 'chart.column', heading: 'Spend share', unit: '%', categories: ['2023', '2024', '2025'],
    series: [{ name: 'Anthropic', values: [12, 24, 40] }, { name: 'OpenAI', values: [50, 34, 27] }, { name: 'Google', values: [7, 12, 21] }, { name: 'Other', values: [31, 30, 12] }] } }]);
const marks = deck.slides[0].nodes.filter((n) => n.role === 'chart-mark');
const fill = (series) => [...new Set(marks.filter((m) => m.data.series === series).map((m) => m.style.fill.tokenId))];
console.log(JSON.stringify({ subject: fill('Anthropic'), peers: [...new Set(['OpenAI', 'Google', 'Other'].flatMap(fill))] }));
""")
        self.assertEqual(result["subject"], ["color.componentPrimary"])
        self.assertEqual(result["peers"], ["color.chartComparator"])

    def test_iso_months_read_as_months_and_tick_by_the_quarter(self):
        result = run_node(f"""
import {{ readablePeriod, monthlyLabelStep }} from '{RUNTIME}/time-axis.mjs';
import {{ compilePage }} from '{KIT}';
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
{PAGE}
const months = Array.from({{ length: 13 }}, (_, i) => {{ const t = 2025 * 12 + 7 + i; return `${{Math.floor(t / 12)}}-${{String(t % 12 + 1).padStart(2, '0')}}`; }});
const page = compilePage({{ ...base, id: 'p1', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Anthropic passed OpenAI in purchase incidence by May',
  exhibit: {{ heading: 'Share of firms, %', categories: months, series: [{{ name: 'A', values: months.map((_, i) => 16 + i * 2) }}, {{ name: 'B', values: months.map(() => 40) }}],
    annotations: [{{ category: '2026-05', text: 'The first month the challenger led the incumbent in the panel' }}] }} }});
const nodes = REGISTRY.get('chart.line').render({{ id: 'c', frame: {{ x: 0, y: 0, width: 800, height: 400 }}, props: {{ highlights: [], referenceLines: [], ...page.exhibit }} }}).nodes;
console.log(JSON.stringify({{ one: readablePeriod('2025-08'), step: monthlyLabelStep(months), first: page.exhibit.categories[0], callout: page.exhibit.annotations[0].category,
  ticks: nodes.filter((n) => n.role === 'category-label').map((n) => n.text) }}));
""")
        self.assertEqual(result["one"], "Aug 25")
        self.assertEqual(result["step"], 3)
        self.assertEqual(result["first"], "Aug 25")
        self.assertEqual(result["callout"], "May 26")
        self.assertEqual(result["ticks"], ["Aug 25", "Nov 25", "Feb 26", "May 26", "Aug 26"])

    def test_captions_are_text_and_the_statement_box_is_the_takeaway_alone(self):
        result = run_node(DECK + """
const chart = (heading, caption) => ({ type: 'chart.column', heading, unit: '%', categories: ['2022', '2023', '2024', '2025'], series: [{ name: 's', values: [1, 2, 3, 4] }], caption });
const deck = build([{ id: 's', title: 'Two panels, each with its finding', layout: 'two-up', exhibits: [chart('Margin', 'Margins rose in every year of the run'), chart('Cost', 'Costs fell at every operator we measured')] }]);
const nodes = deck.slides[0].nodes;
console.log(JSON.stringify({ captions: nodes.filter((n) => n.role === 'insight-caption').map((n) => n.style.align), boxes: nodes.filter((n) => n.role === 'insight-surface').length }));
""")
        self.assertEqual(result["captions"], ["left", "left"])
        self.assertEqual(result["boxes"], 0)

    def test_a_charts_mark_count_steps_its_labels_not_the_pages_prose(self):
        result = run_node(DECK + """
const categories = Array.from({ length: 13 }, (_, i) => String(2012 + i));
const deck = build([{ id: 's', title: 'Thirteen years of one measure', layout: 'exhibit-left', exhibit: { type: 'chart.column', heading: 'Volume', unit: 'm', categories, series: [{ name: 'v', values: categories.map((_, i) => i + 1) }] },
  points: ['The measure rose in every year of the thirteen.', 'The rise was fastest after the policy change.'] }]);
const slide = deck.slides[0];
console.log(JSON.stringify({ density: slide.density, body: slide.tokens['type.body'].value, chart: slide.tokens['type.chartLabel'].value }));
""")
        self.assertEqual(result["density"], "executive")
        self.assertEqual(result["body"], 12)
        self.assertLess(result["chart"], 10)

    def test_a_scatter_y_title_is_its_texts_width(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const points = [1, 2, 3, 4, 5].map((x) => ({{ name: 'p' + x, x, y: x * x % 7 }}));
const nodes = REGISTRY.get('chart.scatter').render({{ id: 'c', frame: {{ x: 0, y: 0, width: 800, height: 420 }}, props: {{ points, yLabel: 'Share, %', xLabel: 'Ratio', annotations: [], highlights: [], referenceLines: [] }} }}).nodes;
console.log(JSON.stringify(nodes.find((n) => n.role === 'axis-title' && n.data.axis === 'y').frame.width));
""")
        self.assertLess(result, 120)


class CollisionTests(unittest.TestCase):
    def test_scene_collisions_find_a_struck_label_and_a_descending_numeral(self):
        result = run_node(f"""
import {{ sceneCollisions }} from '{RUNTIME}/validate-overlap.mjs';
const text = (id, role, frame, extra = {{}}) => ({{ id, type: 'text', role, text: 'label 35', frame, style: {{ align: 'left', valign: 'top', fontFamily: {{ tokenId: 'font.body' }}, fontSize: {{ value: 10 }} }}, data: {{ textLayout: {{ width: frame.width, height: frame.height }} }}, ...extra }});
const line = (id, role, x1, y1, x2, y2) => ({{ id, type: 'line', role, frame: {{ x: x1, y: Math.min(y1, y2), width: x2 - x1, height: Math.abs(y2 - y1) }}, data: {{ x1, y1, x2, y2 }} }});
const numeral = (font) => ({{ id: 'n', type: 'text', role: 'divider-number', text: '3', frame: {{ x: 60, y: 100, width: 200, height: 200 }}, style: {{ valign: 'bottom', fontFamily: {{ tokenId: font }}, fontSize: {{ value: 170 }} }}, data: {{}} }});
const bar = {{ id: 'b', type: 'rect', role: 'divider-accent', frame: {{ x: 60, y: 320, width: 64, height: 4 }} }};
console.log(JSON.stringify({{
  struck: sceneCollisions({{ id: 's', nodes: [text('t', 'flow-arrow-label', {{ x: 100, y: 100, width: 60, height: 14 }}), line('l', 'flow-arrow', 80, 107, 200, 107)] }}).map((f) => f.code),
  clear: sceneCollisions({{ id: 's', nodes: [text('t', 'flow-arrow-label', {{ x: 100, y: 80, width: 60, height: 14 }}), line('l', 'flow-arrow', 80, 107, 200, 107)] }}).length,
  serif: sceneCollisions({{ id: 's', nodes: [numeral('font.display'), bar] }}).map((f) => f.code),
  lining: sceneCollisions({{ id: 's', nodes: [numeral('font.body'), bar] }}).length,
}}));
""")
        self.assertEqual(result["struck"], ["TEXT_ON_LINE"])
        self.assertEqual(result["clear"], 0)
        self.assertEqual(result["serif"], ["DESCENDER_ON_RULE"])
        self.assertEqual(result["lining"], 0)

    def test_a_label_is_read_by_its_glyphs_not_the_slot_it_is_set_in(self):
        # A line chart's value label is a 60px slot round four figures. Read as
        # ink, the slot put the series' own segments through every label.
        result = run_node(f"""
import {{ sceneCollisions, inkBox }} from '{RUNTIME}/validate-overlap.mjs';
const label = {{ id: 'v', type: 'text', role: 'data-label', text: '91.2', frame: {{ x: 872.9, y: 331.9, width: 60, height: 24 }},
  style: {{ align: 'center', valign: 'mid', bold: true, fontFamily: {{ value: 'Arial' }}, fontSize: {{ value: 10 }} }}, data: {{}} }};
const line = (x1, y1, x2, y2) => ({{ id: 'l', type: 'line', role: 'chart-line', frame: {{ x: x1, y: Math.min(y1, y2), width: x2 - x1, height: Math.abs(y2 - y1) }}, data: {{ x1, y1, x2, y2 }} }});
const ink = inkBox(label);
console.log(JSON.stringify({{ ink,
  beside: sceneCollisions({{ id: 's', nodes: [label, line(902.9, 325.9, 965.1, 362.7)] }}).length,
  through: sceneCollisions({{ id: 's', nodes: [label, line(850, 344, 960, 344)] }}).map((f) => f.code) }}));
""")
        self.assertLess(result["ink"]["width"], 30)
        self.assertLess(result["ink"]["height"], 12)
        self.assertEqual(result["beside"], 0, "the segment leaving the point passes the slot's corner, not the figures")
        self.assertEqual(result["through"], ["TEXT_ON_LINE"])

    def test_the_scene_checks_are_gate_findings_the_build_reports(self):
        result = run_node(f"""
import {{ sceneDesignFindings, OVERLAP_CODES, OVERLAP_SEVERITY }} from '{RUNTIME}/validate-overlap.mjs';
import {{ withFindings, buildOutcome }} from '{RUNTIME}/build-deck.mjs';
import {{ applyRulesVersion }} from '{RUNTIME}/weight.mjs';
const text = (id, frame) => ({{ id, type: 'text', role: 'flow-arrow-label', text: 'agent role', frame, style: {{ align: 'left', valign: 'top', fontSize: {{ value: 10 }} }}, data: {{}} }});
const arrow = {{ id: 'a', type: 'line', role: 'flow-arrow', frame: {{ x: 80, y: 107, width: 120, height: 0 }}, data: {{ x1: 80, y1: 107, x2: 200, y2: 107 }} }};
const box = {{ id: 'b', type: 'rect', role: 'flow-step', frame: {{ x: 300, y: 80, width: 100, height: 60 }} }};
const scene = {{ slides: [{{ id: 'cover', nodes: [] }}, {{ id: 'p1', nodes: [text('t', {{ x: 100, y: 100, width: 60, height: 14 }}), arrow] }}, {{ id: 'p2', nodes: [text('e', {{ x: 240, y: 100, width: 59, height: 14 }}), box] }}] }};
const found = sceneDesignFindings(scene);
const outcome = (findings) => buildOutcome({{ preflight: withFindings({{ passed: true, findings: [] }}, findings), readback: {{ accepted: true }} }}, {{ render: false }});
const older = applyRulesVersion(found, {{ workflow: 'existing_deck_revision', rulesVersion: 2 }});
console.log(JSON.stringify({{ found: found.map((f) => [f.slide, f.id, f.code, f.severity]), codes: Object.keys(OVERLAP_CODES).sort(), held: Object.keys(OVERLAP_SEVERITY).sort(),
  status: outcome(found).status, blockers: outcome(found).blockers.map((b) => b.code), edgeOnly: outcome(found.filter((f) => f.code === 'TEXT_ON_EDGE')).status,
  older: outcome(older).status }}));
""")
        self.assertEqual(result["codes"], result["held"], "every scene check has a severity")
        self.assertIn([2, "p1", "TEXT_ON_LINE", "blocker"], result["found"])
        self.assertIn([3, "p2", "TEXT_ON_EDGE", "advisory"], result["found"])
        self.assertEqual(result["status"], "built-with-blockers")
        self.assertEqual(result["blockers"], ["TEXT_ON_LINE"])
        self.assertEqual(result["edgeOnly"], "built-unrendered")
        self.assertEqual(result["older"], "built-unrendered", "a revision under older rules hears it as advice")

    def test_a_reference_label_is_set_clear_of_the_series_it_crosses(self):
        # A break-even line at zero, crossed by a joined series near the
        # plot's right end: the label took the first free corner of the marks
        # and the series ran through it.
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ sceneCollisions }} from '{RUNTIME}/validate-overlap.mjs';
const costs = [0, 20, 40, 55, 60, 80, 85, 100];
const points = [15, 45].flatMap((take) => costs.map((x) => ({{ name: `${{take}}% take, $${{x}} cost`, x, y: 100 - take - x, series: `${{take}}% take`, showLabel: false }})));
const nodes = REGISTRY.get('chart.scatter').render({{ id: 'c', frame: {{ x: 60, y: 160, width: 780, height: 460 }}, props: {{ points, connect: true,
  xLabel: 'Serving cost, $', yLabel: 'Contribution, $', xScale: {{ min: 0, max: 100, step: 25 }}, yScale: {{ min: -50, max: 100, step: 25 }},
  referenceLines: [{{ value: 0, label: 'Break-even: $55 at 45% take, $85 at 15%' }}], annotations: [], highlights: [] }} }}).nodes;
console.log(JSON.stringify(sceneCollisions({{ id: 's', nodes }}).map((f) => f.code)));
""")
        self.assertEqual(result, [])

    def test_the_build_and_authoring_run_the_scene_checks(self):
        # The checks shipped unwired: validate-overlap.mjs was imported by the
        # eval suite alone. The build and authoring both read them now.
        for name in ("build-deck.mjs", "author-deck.mjs"):
            source = (Path(__file__).resolve().parents[2] / "skills/professional-slides/runtime" / name).read_text(encoding="utf-8")
            self.assertIn("sceneDesignFindings(", source, name)


class CoverDividerClosingTests(unittest.TestCase):
    def test_the_cover_title_is_a_step_up_and_carries_the_players_marks(self):
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const mark = (name) => ({{ dataUri: png, width: 1, height: 1, alt: name + ' logo', authorization: name + ' logo' }});
const nodes = REGISTRY.get('cover').render({{ id: 'c', frame: {{ x: 0, y: 0, width: 1280, height: 720 }}, props: {{ title: 'Anthropic versus OpenAI', marks: [mark('A'), mark('B')] }} }}).nodes;
const title = nodes.find((n) => n.role === 'cover-title');
console.log(JSON.stringify({{ size: title.style.fontSize.tokenId, marks: nodes.filter((n) => n.role === 'cover-mark').length, tiles: nodes.filter((n) => n.role === 'cover-mark-tile').length }}));
""")
        self.assertEqual(result["size"], "type.coverTitle")
        self.assertEqual(result["marks"], 2)
        self.assertEqual(result["tiles"], 2)

    def test_a_section_is_numbered_once_and_the_closing_bolds_only_its_leads(self):
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
{DECK}
const deck = build([compilePage({{ id: 's1', kind: 'section', title: '01 / Demand and market position', summary: 'Audience and spend' }}), {{ id: 'p', title: 'A page', points: ['One point.'] }},
  compilePage({{ id: 's2', kind: 'section', title: '02 / Revenue', summary: 'Scale' }}), {{ id: 'q', title: 'Another page', points: ['One point.'] }}]);
const divider = deck.slides.find((s) => s.nodes.some((n) => n.role === 'divider-title'));
const out = REGISTRY.get('takeaways').render({{ id: 't', frame: {{ x: 0, y: 0, width: 1280, height: 720 }}, props: {{ items: ['Short run: OpenAI is better placed for attention and distribution across its billion weekly users.', 'Capital: the larger raise and the higher mark belong to different firms.'] }} }}).nodes;
const item = out.find((n) => n.role === 'takeaways-item');
console.log(JSON.stringify({{ compiled: compilePage({{ id: 's1', kind: 'section', title: '01 / Demand' }}).title,
  title: divider.nodes.find((n) => n.role === 'divider-title').text, numeral: divider.nodes.find((n) => n.role === 'divider-number')?.style.fontFamily.tokenId ?? null,
  runs: item.runs.map((r) => r.bold), bold: item.style.bold }}));
""")
        self.assertEqual(result["compiled"], "Demand")
        self.assertEqual(result["title"], "Demand and market position")
        self.assertIn(result["numeral"], (None, "font.body"))
        self.assertEqual(result["runs"], [True, False])
        self.assertFalse(result["bold"])


if __name__ == "__main__":
    unittest.main()
