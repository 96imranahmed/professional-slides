"""Gaps found by re-authoring a fifty-six-page deck through its page types.

Each class is one thing the author could only learn by failing, or one page
that compiled and rendered wrong:

- a page's `highlight` compiled on an executive summary, a rail, a comparison
  and a findings matrix, and rendered no accent anywhere;
- a callout on either of two six-bar panels left an empty band over the other,
  and a callout on the longest bar had no position at all;
- points under a row of panels ran 150 characters a line and CPL passed them;
- a combo's second-scale line was drawn flat;
- the ink estimate passed a page of native line charts and missed hollow tiles;
- a subtitle restating the chart's heading passed;
- a run of three panels pages named no page to change;
- the word floor a placement sets, the icon names and the distribution's
  label thinning were learnt from errors;
- a caption became a restatement the moment a callout was added;
- PLOT_SPAN failed a bar panel whose width went on its names.

Each test builds the case that failed and reads the compiled or composed page.
"""
import json
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402
import scene_ink  # noqa: E402

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
// The emphasised text of a composed page, runs joined across line breaks.
const lit = (slide) => slide.nodes.map((n) => (n.runs || []).map((r) => (r.text === '\\n' ? ' ' : r.accent || r.bold ? r.text.replace(/\\n/g, ' ') : ' | ')).join('')).join(' | ');
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const regions = ['Europe', 'East Asia & Australasia', 'Americas', 'West Asia & Indian Ocean', 'Africa', 'Middle East'];
"""


class HighlightLandsEverywhereTests(unittest.TestCase):
    def test_every_place_a_page_writes_its_phrase_draws_it(self):
        result = run_node(PRELUDE + """
const summary = { ...base, id: 'es', type: 'summary', form: 'executive-summary', commentary: 'none', title: 'The operator leads on scale, margin and network today',
  highlight: ['11.4 million more', 'yield rose 53%'],
  points: ['The operator carried 53.2 million passengers, 11.4 million more than its nearest rival, and its hub stayed the busiest.',
           'It earned a 15.0% margin because yield rose 53% in ten years while unit cost rose 30%.'],
  exhibit: { type: 'table', columns: ['Pillar', 'Evidence', 'Condition'], rows: [['Scale', '53.2m passengers', 'Traffic recovers'], ['Economics', '15.0% margin', 'Yield holds'], ['Network', 'First in the region', 'Banks restored']] } };
const rail = { ...base, id: 'rl', type: 'trend', form: 'line', commentary: 'rail', title: 'Hub traffic is ten percent above its 2019 level',
  highlight: '95.2m against 54.3m',
  rail: 'The smaller hubs grew faster from smaller bases; the larger hub still handled 95.2m against 54.3m in the latest year.',
  exhibit: { heading: 'Passengers', unit: 'million', categories: years, referenceLines: [{ value: 86, label: '2019 level' }],
    series: [{ name: 'Hub', values: [89, 86, 26, 29, 66, 87, 92, 95] }, { name: 'Rival', values: [37, 39, 13, 18, 36, 46, 53, 54] }] } };
const compare = { ...base, id: 'cp', type: 'options', form: 'compare', commentary: 'in-exhibit', title: 'The smaller aircraft is flying while the larger one waits',
  highlight: 'not an operator date',
  exhibit: { left: { heading: 'Smaller type', points: ['In service: 19 aircraft', 'On order: 54 aircraft'] },
             right: { heading: 'Larger type', points: ['In service: none', 'Arriving: the maker aims for 2027, not an operator date'] }, winner: 'left' } };
const matrix = { ...base, id: 'mx', type: 'matrix', form: 'findings-matrix', commentary: 'in-exhibit', title: 'Headline destination counts hide incompatible definitions',
  highlight: '91 actually operated',
  columns: ['Carrier', 'Published claim', 'Why it cannot be ranked'],
  rows: [{ label: 'First', cells: [['152 cities', 'Operated at year end'], 'A snapshot that excludes partner cities'] },
         { label: 'Second', cells: [['110 published destinations', '91 actually operated in December'], 'Includes seasonal and planned services'] },
         { label: 'Third', cells: [['219 routes', 'Across six hubs'], 'Routes are city pairs, not cities'] }] };
const bar = { ...base, id: 'sb', type: 'trend', form: 'column', commentary: 'so-what-bar', title: 'Passengers recovered past their 2019 level by 2023',
  highlight: 'eight points of margin', bar: 'Each year of recovery since 2023 has added about eight points of margin to the network.',
  exhibit: { heading: 'Passengers', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }], referenceLines: [{ value: 86, label: '2019 level' }] } };
const captions = { ...base, id: 'pc', type: 'panels', form: 'row', commentary: 'captions', title: 'Revenue grew fastest where the network is smallest',
  highlight: 'only region that shrank',
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }], caption: 'Europe and East Asia earn well over half of the revenue between them' },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }], caption: 'The Americas were the only region that shrank over the year' }] };
const slides = compose([summary, rail, compare, matrix, bar, captions]);
console.log(JSON.stringify(Object.fromEntries(slides.map((s) => [s.id, lit(s)]))));
""")
        self.assertIn("11.4 million more", result["es"], "points below an executive summary's table")
        self.assertIn("yield rose 53%", result["es"])
        self.assertIn("95.2m", result["rl"], "the rail")
        self.assertIn("not an operator date", result["cp"], "a comparison column")
        self.assertIn("91 actually operated", result["mx"], "a bulleted matrix cell")
        self.assertIn("eight points of margin", result["sb"], "the so-what bar")
        self.assertIn("only region that shrank", result["pc"], "a panel caption")

    def test_a_dark_rail_where_the_accent_does_not_read_sets_the_phrase_bold(self):
        result = run_node(PRELUDE + """
import { sideStatementNodes } from './skills/professional-slides/runtime/figures.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const frame = { x: 0, y: 0, width: 380, height: 500 };
const text = 'Faster growth is not a larger hub yet: the hub still handled 95.2m against 54.3m.';
const node = (tone) => sideStatementNodes({ id: 'r', frame, props: { text, tone, highlight: ['95.2m against 54.3m'] } }).find((n) => n.role === 'side-panel-text');
const dark = node('dark'), tint = node('tint');
console.log(JSON.stringify({ darkBold: dark.style.bold, darkRuns: dark.runs, tintRuns: tint.runs }));
""")
        runs = result["darkRuns"]
        phrase = [r for r in runs if "95.2m" in r["text"]]
        self.assertTrue(phrase and all(r["bold"] for r in phrase))
        # Either the accent reads on the fill, or the sentence drops to regular
        # weight so the bold phrase stands out.
        self.assertTrue(any(r.get("accent") for r in runs) or (result["darkBold"] is False and not all(r["bold"] for r in runs)))
        self.assertTrue(any((r.get("accent") or r["bold"]) and "95.2m" in r["text"] for r in result["tintRuns"]))

    def test_a_phrase_the_page_draws_nowhere_is_refused_with_where_it_is(self):
        result = run_node(PRELUDE + """
const page = (highlight) => ({ ...base, id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Passengers recovered past their 2019 level by 2023',
  highlight, exhibit: { heading: 'Passengers', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }],
    annotations: [{ category: '2020', text: 'Closure year: traffic fell by seventy percent' }, { category: '2025', text: 'A record year on the new schedule' }] } });
console.log(JSON.stringify({ title: error(() => compilePage(page('2019 level'))), callout: error(() => compilePage(page('record year'))), nowhere: error(() => compilePage(page('never written here'))) }));
""")
        self.assertIn("title", result["title"])
        self.assertIn("callout", result["callout"])
        self.assertIn("nowhere", result["nowhere"], "a page with no commentary text refuses any highlight")


class CalloutOnBarPanelsTests(unittest.TestCase):
    def test_a_callout_on_either_bar_panel_leaves_no_empty_band(self):
        result = run_node(PRELUDE + """
const page = (left, right) => ({ ...base, id: 'p', type: 'panels', form: 'row', commentary: 'captions', title: 'Revenue grew fastest where the network is smallest',
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }], highlights: [{ category: 'Europe' }], annotations: left, caption: 'The two long-haul regions earn well over half of all the revenue' },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }], annotations: right, caption: 'Africa grew fastest and the Americas were the one fall of the year' }] });
const [plain, long, negative] = compose([page([], []), page([{ category: 'Europe', text: 'Largest region for a decade' }], []), page([], [{ category: 'Americas', text: 'The only region that shrank' }])]);
const tops = (s) => [0, 1].map((i) => Math.min(...s.nodes.filter((n) => n.role === 'chart-mark' && n.id.includes(`exhibit-${i}:`)).map((n) => n.frame.y)));
const note = (s) => s.nodes.find((n) => n.role === 'annotation-text');
const bar = (s, i, c) => s.nodes.find((n) => n.role === 'chart-mark' && n.id.includes(`exhibit-${i}:`) && n.data.category === c).frame;
console.log(JSON.stringify({ plain: tops(plain), long: tops(long), negative: tops(negative), longNote: note(long).frame, europe: bar(long, 0, 'Europe'),
  negNote: note(negative).frame, americas: bar(negative, 1, 'Americas') }));
""")
        # No band reserved over either plot: the bars start where they do with no callout.
        self.assertEqual(result["long"], result["plain"])
        self.assertEqual(result["negative"], result["plain"])
        note, europe = result["longNote"], result["europe"]
        self.assertGreaterEqual(note["x"], europe["x"])
        self.assertLessEqual(note["x"] + note["width"], europe["x"] + europe["width"] + 0.5, "set inside the longest bar")
        self.assertGreaterEqual(note["y"], europe["y"])
        neg, americas = result["negNote"], result["americas"]
        self.assertGreater(neg["x"], americas["x"] + americas["width"], "past the axis, in the bar's own row")
        self.assertLess(abs((neg["y"] + neg["height"] / 2) - (americas["y"] + americas["height"] / 2)), americas["height"])

    def test_a_chart_with_width_to_spare_keeps_the_boxed_rail(self):
        result = run_node(PRELUDE + """
const props = { heading: 'Mix', unit: '%', categories: ['Europe', 'E Asia', 'Americas', 'Africa'], series: [{ name: 'Share', values: [95, 96, 97, 99] }],
  annotations: [{ category: 'Americas', text: 'Americas now the second largest market by revenue' }], highlights: [], referenceLines: [] };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 72, y: 180, width: 700, height: 460 }, props }).nodes;
console.log(JSON.stringify({ boxed: nodes.some((n) => n.role === 'annotation-surface'), placement: nodes.find((n) => n.role === 'annotation-text').data.evidencePlacement }));
""")
        self.assertTrue(result["boxed"])
        self.assertEqual(result["placement"], "rail")


class CalloutInThePlotTests(unittest.TestCase):
    def test_a_callout_takes_free_space_in_the_plot_before_a_band(self):
        result = run_node(PRELUDE + """
const categories = ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'];
const props = (annotations, extra = {}) => ({ categories, series: [{ name: 'Passengers', values: [56, 58, 59, 56, 7, 20, 44, 52, 54, 53] }], highlights: [], referenceLines: [], annotations, ...extra });
const frame = { x: 72, y: 150, width: 1136, height: 440 };
const render = (p) => REGISTRY.get('chart.column').render({ id: 'c', frame, props: p }).nodes;
const notes = [{ category: 'FY21', text: 'Closure: 7m' }, { category: 'FY22', text: 'Reopening: 20m' }];
const tallest = (nodes) => Math.max(...nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.height));
const plain = render(props([])), inPlot = render(props(notes)), banded = render(props(notes, { calloutBand: 'band' }));
const boxes = inPlot.filter((n) => n.role === 'annotation-surface');
const marks = inPlot.filter((n) => n.role === 'chart-mark').map((n) => n.frame);
const meet = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
console.log(JSON.stringify({ plain: tallest(plain), inPlot: tallest(inPlot), banded: tallest(banded), placements: boxes.map((b) => b.data.evidencePlacement),
  clear: boxes.every((b) => marks.every((m) => !meet(b.frame, m))) }));
""")
        self.assertEqual(result["placements"], ["beside", "beside"], "above the short pandemic columns, in the plot")
        self.assertAlmostEqual(result["inPlot"], result["plain"], delta=0.5, msg="the plot keeps its height")
        self.assertLess(result["banded"], result["plain"] - 40, "a band would have taken it")
        self.assertTrue(result["clear"])


class PointsUnderPanelsTests(unittest.TestCase):
    def test_points_below_a_row_of_panels_run_in_columns_at_a_readable_measure(self):
        result = run_node(PRELUDE + """
const points = ['Europe and East Asia with Australasia earn AED75.3bn together, 59% of the revenue, so the long-haul premium markets carry the business.',
  'Africa added AED970m in the year, close to the gains of the two far larger regions, and is the fastest-growing market.',
  'The Americas were the only region to shrink, falling 3.2% as routes were cut back after the shock to hub traffic.'];
const page = (n) => ({ ...base, id: 'p' + n, type: 'panels', form: 'row', commentary: 'below', title: 'Revenue grew fastest where the network is smallest',
  highlight: ['59% of the revenue', 'AED970m', 'only region to shrink'].slice(0, n), points: points.slice(0, n),
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }] },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }] }] });
const [two, three] = compose([page(2), page(3)]);
const items = (s) => s.nodes.filter((n) => n.role === 'list-item').map((n) => ({ x: n.frame.x, width: n.frame.width, longest: Math.max(...n.data.textLayout.lines.map((l) => l.length)) }));
const panels = two.componentInstances.filter((c) => c.component === 'chart.bar').map((c) => c.frame);
console.log(JSON.stringify({ two: items(two), three: items(three), panels }));
""")
        for layout in (result["two"], result["three"]):
            self.assertTrue(all(item["longest"] <= 90 for item in layout), layout)
        self.assertEqual(len({round(i["x"]) for i in result["three"]}), 3, "three across")
        # One point to a panel sits under its panel.
        for item, panel in zip(sorted(result["two"], key=lambda i: i["x"]), sorted(result["panels"], key=lambda p: p["x"])):
            self.assertGreaterEqual(item["x"], panel["x"] - 1)
            self.assertLessEqual(item["x"] + item["width"], panel["x"] + panel["width"] + 1)

    def test_cpl_reads_points_that_run_too_wide(self):
        wide = {"type": "text", "role": "list-item", "text": "x" * 140, "data": {"textLayout": {"lines": ["word " * 28]}}}
        narrow_card = {"type": "text", "role": "list-item", "text": "a\nb", "data": {"textLayout": {"lines": ["A short", "bullet"]}}}
        findings = []
        page_gates.gate_cpl(1, {"nodes": [wide, narrow_card]}, findings)
        self.assertEqual([f["code"] for f in findings], ["CPL"])
        self.assertIn("columns", findings[0]["repair"])


class ComboLineTests(unittest.TestCase):
    def test_a_second_scale_line_drawn_flat_is_refused_for_panels(self):
        result = run_node(PRELUDE + """
const props = (extra) => ({ categories: ['FY17','FY18','FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'],
  series: [{ name: 'Capital expenditure', values: [12.6, 8.5, 13.4, 11.9, 5, 7.4, 5.3, 8, 13.8, 17.5] }, { name: 'Average fleet age', values: [5.2, 5.7, 6.1, 6.8, 7.3, 8.2, 9.1, 10.1, 10.7, 10.8] }],
  secondaryUnit: ' yrs', highlights: [], referenceLines: [], annotations: [], ...extra });
const render = (p) => { try { return REGISTRY.get('chart.combo').render({ id: 'c', frame: { x: 0, y: 0, width: 760, height: 430 }, props: p }).nodes; } catch (e) { return e.message; } };
// Two callouts in their band above the plot (`calloutBand: 'band'`) take the height the line's band needs.
const squeezed = render(props({ secondaryAxis: true, calloutBand: 'band', annotations: [{ category: 'FY23', text: 'Capex trough of AED5.3bn' }, { category: 'FY26', text: 'AED17.5bn, the highest in ten years' }] }));
const roomy = render(props({ secondaryAxis: true }));
const rise = (nodes) => { const ys = nodes.filter((n) => n.role === 'chart-marker').map((n) => n.frame.y); return Math.max(...ys) - Math.min(...ys); };
console.log(JSON.stringify({ squeezed, roomyRise: rise(roomy) }));
""")
        self.assertIsInstance(result["squeezed"], str)
        self.assertIn("panels", result["squeezed"])
        self.assertGreaterEqual(result["roomyRise"], 48)


class InkEstimateTests(unittest.TestCase):
    CANVAS = "#FAF7F2"

    def slide(self, nodes, instances=None):
        return {"tokens": {"color.canvas": {"value": self.CANVAS}}, "nodes": nodes, "componentInstances": instances or []}

    @staticmethod
    def text(x, y, width, lines, color="#6B645C", size=10):
        return {"type": "text", "role": "fact-text", "frame": {"x": x, "y": y, "width": width, "height": 16 * len(lines)},
                "text": "\n".join(lines), "style": {"color": {"value": color}, "fontSize": {"value": size}},
                "data": {"textLayout": {"lines": lines, "lineHeight": 16, "width": width}}}

    def test_grey_type_on_a_tint_counts_in_patches_not_all_or_nothing(self):
        tile = {"type": "rect", "role": "fact-tile", "frame": {"x": 72, "y": 190, "width": 560, "height": 193}, "style": {"fill": {"value": "#F0EBE3"}}}
        lines = ["Carried in 2025 on 97 narrowbody aircraft, from secondary regional cities"] * 3
        with_text = scene_ink.estimate(self.slide([tile, self.text(88, 300, 540, lines)]))
        without = scene_ink.estimate(self.slide([tile]))
        self.assertGreater(with_text, without, "hollow tiles' grey type reads as some ink, as the render reads it")
        # Evenly painted, as the first fit painted it, the same type counted less.
        self.assertLess(scene_ink.estimate(self.slide([tile, self.text(88, 300, 540, lines)]), 0.16, 1.2, 0.0, 1.0, 1.0), with_text)

    def test_a_native_charts_plot_and_a_hairline_read_lighter(self):
        line = {"type": "line", "role": "chart-line", "frame": {"x": 100, "y": 300, "width": 900, "height": 0},
                "style": {"stroke": {"value": "#C49A6C"}, "lineWidth": {"value": 3.5}},
                "data": {"x1": 100, "y1": 300, "x2": 1000, "y2": 300, "componentInstance": "p:chart"}}
        drawn = scene_ink.estimate(self.slide([line]))
        native = scene_ink.estimate(self.slide([line], [{"instanceId": "p:chart", "nativeChart": {}}]))
        self.assertLessEqual(native, drawn)
        rule = {"type": "line", "role": "section-heading-rule", "frame": {"x": 72, "y": 300, "width": 1136, "height": 0},
                "style": {"stroke": {"value": "#221E1A"}, "lineWidth": {"value": 1}}, "data": {}}
        self.assertLess(scene_ink.estimate(self.slide([rule])), scene_ink.estimate(self.slide([rule]), hairline=1.0) + 1e-9)


class SubtitleAgainstHeadingTests(unittest.TestCase):
    def test_a_subtitle_that_restates_the_chart_heading_is_refused(self):
        result = run_node(PRELUDE + """
const page = (subtitle) => ({ ...base, id: 'p', type: 'trend', form: 'column', commentary: 'on-exhibit', title: 'Passengers recovered past their 2019 level by 2023', subtitle,
  exhibit: { heading: 'Airport passengers, 2019 to 2025', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }],
    annotations: [{ category: '2020', text: 'Closure year: traffic fell by seventy percent' }, { category: '2025', text: 'A record year on the new schedule' }] } });
console.log(JSON.stringify({ restated: error(() => compilePage(page('Airport passengers 2019 to 2025, million'))), scope: error(() => compilePage(page('Calendar years; the hub operator\\'s own counts, all terminals'))) }));
""")
        self.assertIn("heading", result["restated"])
        self.assertIsNone(result["scope"])


class TypeRunTests(unittest.TestCase):
    def test_the_run_names_the_page_to_change_and_to_what(self):
        result = run_node(PRELUDE + """
import { varietyFindings } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const types = ['trend', 'ranking', 'numbers', 'panels', 'panels', 'panels', 'trend', 'composition', 'ranking', 'matrix', 'numbers', 'scorecard', 'bridge', 'lookup'];
const slides = types.map((type, i) => ({ id: 'p' + (i + 1), title: 'T', pageType: { type, form: 'x', commentary: ['beside', 'below', 'rail', 'none', 'captions'][i % 5], takeaway: false } }));
const run = varietyFindings({ slides }).find((f) => f.code === 'VARIETY_TYPE_RUN');
console.log(JSON.stringify(run));
""")
        self.assertEqual(result["measured"]["pages"], ["p4", "p5", "p6"])
        self.assertIn("Change p5", result["repair"])
        self.assertIn("trade places with", result["repair"])
        self.assertIn("p4 panels", result["measured"]["sequence"])


class PublishedLimitsTests(unittest.TestCase):
    def test_types_publishes_floors_icons_and_label_thinning(self):
        result = run_node(PRELUDE + """
console.log(JSON.stringify({ types: describeTypes() }));
""")
        types = result["types"]
        self.assertIn("Word floors follow the reading task", types)
        self.assertIn("chart pages 42 words led, 96 with points", types)
        self.assertIn("plane", types)
        self.assertIn("names every member while its rows hold a line", types)

    def test_an_unknown_icon_is_refused_at_compile_with_the_nearest(self):
        result = run_node(PRELUDE + """
import { nearestIcons, iconDefinition } from './skills/professional-slides/runtime/icons.mjs';
const page = (icon) => ({ ...base, id: 'p', type: 'parallel', form: 'cards', commentary: 'none', title: 'Three levers carry the plan through to the end of the decade',
  exhibit: { items: ['Fleet', 'Network', 'Product'].map((title) => ({ title, icon, text: 'A lever the plan pulls in each of the next three years, with its own owner.' })) } });
console.log(JSON.stringify({ refused: error(() => compilePage(page('aeroplanes'))), alias: Boolean(iconDefinition('aircraft')), plane: Boolean(iconDefinition('plane')), near: nearestIcons('ships') }));
""")
        self.assertIn("plane", result["refused"])
        self.assertIn("--icons", result["refused"])
        self.assertTrue(result["alias"] and result["plane"])
        self.assertEqual(result["near"][0], "ship")

    def test_a_distribution_names_every_member_at_8pt_before_it_thins_and_always_the_called_out(self):
        result = run_node(PRELUDE + """
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const field = (n, extra = {}) => { const categories = Array.from({ length: n }, (_, i) => 'Op' + String(i + 1).padStart(2, '0'));
  const props = { categories, series: [{ name: 'V', values: categories.map((_, i) => 200 - i * 3) }], highlights: [{ category: 'Op20' }], annotations: [], referenceLines: [], ...extra };
  const frame = { x: 0, y: 0, width: 760, height: 440 };
  const nodes = REGISTRY.get('chart.bar').render({ id: 'd', frame, props }).nodes;
  return { nodes, props, frame }; };
const labels = ({ nodes }) => nodes.filter((n) => n.role === 'category-label');
const small = field(32), thin = field(40, { annotations: [{ category: 'Op33', text: 'The one new entrant' }] });
const spec = nativeChartSpec('chart.bar', small.props, small.frame, small.nodes);
console.log(JSON.stringify({ small: labels(small).length, size: labels(small)[0].style.fontSize.value, thin: labels(thin).map((n) => n.text), labelPt: spec && spec.labelPt }));
""")
        self.assertEqual(result["small"], 32)
        self.assertEqual(result["size"], 8)
        self.assertLess(len(result["thin"]), 40)
        self.assertIn("Op33", result["thin"], "the member a callout names keeps its name")
        self.assertIn("Op20", result["thin"])
        self.assertEqual(result["labelPt"], 8)


class RestatementAndCalloutTests(unittest.TestCase):
    @staticmethod
    def node(role, text):
        return {"type": "text", "role": role, "text": text, "data": {"textLayout": {"lines": [text]}}}

    def page(self, callout=None):
        names = ["Europe", "East Asia & Australasia", "Americas", "West Asia & Indian Ocean", "Africa", "Middle East",
                 "North Atlantic routes", "Southern Cone routes"]
        nodes = [self.node("category-label", n) for n in names]
        nodes += [self.node("panel-caption", "Europe and East Asia with Australasia earn 59% of revenue; the Middle East only 7%")]
        if callout:
            nodes.append(self.node("annotation-text", callout))
        return {"nodes": nodes, "componentInstances": []}

    def test_naming_the_members_is_not_restating_the_chart(self):
        findings = []
        page_gates.gate_restatement(1, self.page("Europe and East Asia earn 59% of all revenue"), findings)
        self.assertEqual(findings, [], "the names are the subject; the callout alone is too short to be a pattern")

    def test_a_caption_that_repeats_the_callout_is_told_so(self):
        slide = self.page()
        slide["nodes"] += [self.node("annotation-text", "Premium cabins earn the widest yield on long routes"),
                           self.node("annotation-text", "Cargo bellies lift network margin through the winter season")]
        slide["nodes"] = [n for n in slide["nodes"] if n["role"] != "panel-caption"] + [
            self.node("panel-caption", "Premium cabins earn the widest yield and cargo bellies lift winter margin")]
        findings = []
        page_gates.gate_restatement(1, slide, findings)
        self.assertEqual([f["code"] for f in findings], ["RESTATEMENT"])
        self.assertIn("callout", findings[0]["measured"])
        self.assertIn("callout", findings[0]["repair"])


class PlotSpanTests(unittest.TestCase):
    def test_a_bar_panel_that_spends_its_width_on_names_and_values_passes(self):
        frame = {"x": 647, "y": 152, "width": 560, "height": 465}
        marks = [{"role": "chart-mark", "frame": {"x": 900 - (40 if i == 2 else 0), "y": 250 + i * 57, "width": 40 if i == 2 else 20 + i * 25, "height": 40}} for i in range(6)]
        names = [{"role": "category-label", "type": "text", "frame": {"x": 655, "y": 250 + i * 57, "width": 168, "height": 40}} for i in range(6)]
        values = [{"role": "data-label", "type": "text", "frame": {"x": 1030, "y": 250 + i * 57, "width": 50, "height": 40}} for i in range(6)]
        slide = {"componentInstances": [{"component": "chart.bar", "frame": frame}], "nodes": marks + names + values}
        findings = []
        page_gates.gate_plot_span(1, slide, findings)
        self.assertEqual(findings, [])
        # The bars alone would have been measured short.
        findings = []
        page_gates.gate_plot_span(1, dict(slide, nodes=marks), findings)
        self.assertEqual([f["code"] for f in findings], ["PLOT_SPAN"])


if __name__ == "__main__":
    unittest.main()
