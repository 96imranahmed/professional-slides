"""A chart draws its data the way the data is: areas from zero, ranks the right way up, gaps left open.

The BA retest's deck review blocked five charts the renderer drew dishonestly
and no gate refused (runtime-defects.md 70-72). The jet fuel line (hw01) and
the low-cost share (sh01) took a lone line's fill down to a floor near their
lows, so a doubling drew as a five-fold rise. IAG's loyalty rank (pr06) and
BA's Skytrax rank (pr07) plotted 1 at the bottom, so a climb from 8th to 4th
drew as a fall and a fall to 23rd as a filled climb. Heathrow's stacked
passengers (lc04) filled straight across 2020-21, periods the survey does not
have. The leverage line (fd09) set 2019, 2022 and H1 2026 one step apart each.
"""
import sys
import unittest

from node_probe import ROOT, run_node

sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402

RUNTIME = "./skills/professional-slides/runtime"

DRAW = f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ nativeChartSpec }} from '{RUNTIME}/core.mjs';
const frame = {{ x: 60, y: 160, width: 900, height: 420 }};
const render = (id, props) => {{
  const full = {{ heading: 'Chart', highlights: [], annotations: [], referenceLines: [], ...props }};
  const out = REGISTRY.get(id).render({{ id: 't', frame, props: full }});
  return {{ nodes: Array.isArray(out) ? out : out.nodes, props: full }};
}};
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const markers = (nodes) => Object.fromEntries(nodes.filter((n) => n.role === 'chart-marker').map((n) => [n.id.split(':').at(-1), n.frame.y + n.frame.height / 2]));
"""


class AreaBaselineTests(unittest.TestCase):
    def test_a_lone_line_is_filled_only_from_zero_and_an_area_starts_at_zero(self):
        """BA retest hw01, sh01: a lone line's fill ran down to a floor near its low, drawing a doubling as a five-fold rise."""
        result = run_node(DRAW + """
const fuel = { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], series: [{ name: 'Jet fuel', values: [2.3, 2.0, 1.9, 2.3, 3.9, 3.7] }] };
const line = render('chart.line', fuel).nodes;
const fromZero = render('chart.line', { ...fuel, yMin: 0 }).nodes;
const area = render('chart.area', fuel).nodes;
const polygon = area.find((n) => n.role === 'chart-area');
const floorY = Math.max(...polygon.data.paths[0].map(([, y]) => y));
console.log(JSON.stringify({
  lineFill: line.filter((n) => n.role === 'chart-area').length,
  zeroFill: fromZero.filter((n) => n.role === 'chart-area').map((n) => n.data.baselineValue),
  areaBaseline: polygon.data.baselineValue, areaFloorAtPlotBottom: Math.abs(floorY - 1) < 1e-6,
  flat: error(() => render('chart.area', { categories: ['2018', '2019', '2022', '2024', '2025'].map((c, i) => `Q${i + 1} 2025`), series: [{ name: 'Low-cost', values: [30.3, 31.9, 32.5, 34.5, 35.2] }] })),
  floored: error(() => render('chart.area', { ...fuel, yMin: 1.5 })) }));
""")
        self.assertEqual(result["lineFill"], 0)  # a scale from 1.9 is no floor to fill from
        self.assertEqual(result["zeroFill"], [0])
        self.assertEqual(result["areaBaseline"], 0)
        self.assertTrue(result["areaFloorAtPlotBottom"])
        self.assertIn("AREA_BASELINE", result["flat"])
        self.assertIn("chart.line", result["flat"])
        self.assertIn("AREA_BASELINE", result["floored"])


class RankTests(unittest.TestCase):
    def test_a_rank_measure_is_read_off_its_unit_and_polarity(self):
        """BA retest pr06, pr07: whether a measure is a rank is read off its recorded unit and `better`, never its name."""
        result = run_node(f"""
import {{ isRankMeasure }} from '{RUNTIME}/measures.mjs';
console.log(JSON.stringify([{{ unit: 'rank', better: 'down' }}, {{ unit: 'Rank, 1 = best' }}, {{ unit: 'USD m', better: 'down' }}, {{ unit: 'rank', better: 'up' }}, {{ unit: 'ranked passengers m' }}].map(isRankMeasure)));
""")
        self.assertEqual(result, [True, True, False, False, False])

    def test_a_rank_plots_with_first_place_at_the_top_and_is_refused_a_filled_mark(self):
        """BA retest pr06, pr07: IAG's climb from 8th to 4th drew as a fall; BA's fall to 23rd as a filled climb."""
        result = run_node(DRAW + """
const rank = { categories: ['2017', '2020', '2023', '2026'], series: [{ name: 'World rank', rank: true, values: [7, 8, 6, 4] }] };
const line = render('chart.line', rank);
const y = markers(line.nodes);
const combo = render('chart.combo', { categories: rank.categories, secondaryAxis: true, series: [{ name: 'Valuation', values: [4750, 5138, 7084, 10345] }, { ...rank.series[0] }] });
const comboY = Object.fromEntries(combo.nodes.filter((n) => n.role === 'chart-marker' || n.data?.series === 'World rank').filter((n) => n.frame && n.data?.category).map((n) => [n.data.category, n.frame.y]));
console.log(JSON.stringify({
  climbs: y['2026'] < y['2023'] && y['2023'] < y['2017'] && y['2017'] < y['2020'],
  filled: line.nodes.filter((n) => n.role === 'chart-area').length,
  native: nativeChartSpec('chart.line', line.props, frame, line.nodes),
  comboClimbs: comboY['2026'] !== undefined ? comboY['2026'] < comboY['2020'] : null,
  area: error(() => render('chart.area', rank)),
  bar: error(() => render('chart.bar', { categories: ['Qatar', 'Iberia', 'BA'], series: [{ name: 'Skytrax rank', rank: true, values: [2, 16, 23] }] })),
  comboBars: error(() => render('chart.combo', { categories: rank.categories, secondaryAxis: true, series: [{ ...rank.series[0] }, { name: 'Valuation', values: [4750, 5138, 7084, 10345] }] })),
  stacked: error(() => render('chart.stacked-area', { categories: rank.categories, series: [{ ...rank.series[0] }, { name: 'Other', rank: true, values: [1, 2, 3, 4] }] })) }));
""")
        self.assertTrue(result["climbs"])
        self.assertEqual(result["filled"], 0)
        self.assertIsNone(result["native"])  # a native line cannot say its axis is turned over
        self.assertTrue(result["comboClimbs"])
        for refused in ("area", "bar", "comboBars", "stacked"):
            self.assertIn("RANK_FILLED", result[refused], refused)


class MissingPeriodTests(unittest.TestCase):
    SURVEY = ["2015", "2016", "2017", "2018", "2019", "2022", "2023", "2025"]

    def test_a_run_of_years_with_periods_left_out_breaks_there(self):
        """BA retest lc04: the stacked area joined 2019 to 2022 across 2020-21, drawing about 70m passengers in years of about 20m."""
        result = run_node(DRAW + f"""
import {{ missingPeriods }} from '{RUNTIME}/time-axis.mjs';
const survey = {self.SURVEY!r};
const series = [{{ name: 'Connecting', values: [26.6, 27.2, 26.3, 28.2, 27.1, 15.0, 21.4, 21.7] }}, {{ name: 'Terminating', values: [48, 49, 51, 52, 53.4, 46, 58, 62.5] }}];
const line = render('chart.line', {{ categories: survey, series }}).nodes;
const segments = line.filter((n) => n.role === 'chart-line').map((n) => n.id.split(':').at(-1));
const area = render('chart.area', {{ categories: survey, series: [series[0]] }}).nodes.find((n) => n.role === 'chart-area');
console.log(JSON.stringify({{
  gaps: missingPeriods(survey), triennial: missingPeriods(['2017', '2020', '2023', '2026']), bunched: missingPeriods(['Jan 25', 'Mar 25', 'Jun 25', 'Aug 25', 'Oct 25']),
  segments: segments.length, areaRuns: area.data.paths.length,
  stacked: error(() => render('chart.stacked-area', {{ categories: survey, series }})) }}));
""")
        self.assertEqual(result["gaps"], [{"after": 4, "from": "2019", "to": "2022"}, {"after": 6, "from": "2023", "to": "2025"}])
        self.assertEqual(result["triennial"], [])  # a survey every three years misses nothing
        self.assertEqual(result["bunched"], [])  # observations one to three months apart are not gaps
        self.assertEqual(result["segments"], 2 * 5)  # 7 joins a series, less the two gaps
        self.assertEqual(result["areaRuns"], 2)  # 2015-2019 and 2022-2023 fill; 2025 alone is its marker
        self.assertIn("AREA_GAP", result["stacked"])

    def test_periods_of_different_lengths_sit_at_their_close(self):
        """BA retest fd09: 2019, 2022, ..., 2025 and H1 2026 were drawn one step apart each."""
        result = run_node(f"""
import {{ timePositions, describeGaps }} from '{RUNTIME}/time-axis.mjs';
const years = ['2019', '2022', '2023', '2024', '2025', 'H1 2026'];
console.log(JSON.stringify({{ at: timePositions(years).map((v) => Math.round(v * 65)), gaps: describeGaps(years), odd: timePositions(['2019', 'Summer 2020', 'H1 2021']) }}));
""")
        # In half-years from the close of 2019: 2022 closes six halves on, H1 2026 one half after 2025.
        self.assertEqual(result["at"], [0, 30, 40, 50, 60, 65])
        self.assertEqual(result["gaps"], "0.5-3 years")
        self.assertIsNone(result["odd"])  # a season beside calendar periods stays on its slots


class AreaBaselineGateTests(unittest.TestCase):
    def test_the_scene_gate_refuses_an_area_filled_from_a_floor(self):
        """BA retest hw01: the scene held a fill down to about USD 1.45 a gallon, and no gate read it."""
        def slide(base):
            return {"id": "hw01", "nodes": [{"type": "shape", "role": "chart-area", "id": "fill", "data": {"series": "Jet fuel", "baselineValue": base}}]}

        findings = []
        page_gates.gate_area_baseline(85, slide(1.45), findings)
        self.assertEqual([f["code"] for f in findings], ["AREA_BASELINE"])
        self.assertEqual(findings[0]["measured"]["baselineValue"], 1.45)
        clean = []
        page_gates.gate_area_baseline(85, slide(0), clean)
        self.assertEqual(clean, [])


class TimeSpacedColumnTests(unittest.TestCase):
    def test_columns_over_uneven_years_stand_where_the_years_fall(self):
        """BA retest sh07: columns for 2019, 2024 and the 2027 plan stood one slot apart, five years and three alike."""
        result = run_node(DRAW + """
const centres = (id, categories) => {
  const drawn = render(id, { categories, series: [{ name: 'Leisure', values: [46, 51, 61] }, { name: 'Other', values: [54, 49, 39] }] });
  const marks = drawn.nodes.filter((n) => n.role === 'chart-mark' && n.data?.series === 'Leisure');
  return { x: marks.map((n) => n.frame.x + n.frame.width / 2), widths: marks.map((n) => n.frame.width), native: nativeChartSpec(id, drawn.props, frame, drawn.nodes) !== null };
};
const uneven = centres('chart.stacked-column', ['2019', '2024', '2027']), even = centres('chart.stacked-column', ['2019', '2020', '2021']);
const broken = render('chart.stacked-column', { categories: ['2019', '2024', '2027'], categoryBreaks: ['2019'], series: [{ name: 'Leisure', values: [46, 51, 61] }] }).nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.x);
console.log(JSON.stringify({ ratio: (uneven.x[2] - uneven.x[1]) / (uneven.x[1] - uneven.x[0]), even: Math.abs((even.x[2] - even.x[1]) - (even.x[1] - even.x[0])) < 0.5,
  overlap: uneven.x[1] - uneven.x[0] < uneven.widths[0], native: [uneven.native, even.native], brokenEven: Math.abs((broken[2] - broken[1]) - (broken[1] - broken[0])) < 0.5 }));
""")
        self.assertAlmostEqual(result["ratio"], 3 / 5, places=2)
        self.assertTrue(result["even"])
        self.assertFalse(result["overlap"])
        self.assertEqual(result["native"], [False, True])  # PowerPoint would set them one slot apart again
        self.assertTrue(result["brokenEven"])  # an axis that marks its break keeps its slots


class TimelineStepTests(unittest.TestCase):
    def test_a_timeline_of_uneven_milestones_says_each_step(self):
        """BA retest hb11: Jul 2023 to 2035 sat at equal intervals, two months and five years one step each."""
        result = run_node(DRAW + f"""
import {{ elapsedSteps }} from '{RUNTIME}/time-axis.mjs';
const dates = ['Jul 2023', 'Jan 2025', 'Sep 2025', 'Nov 2025', 'Jun 2026', '2029', 'c. 2030', '2035'];
const items = dates.map((date, i) => ({{ date, label: `Milestone ${{i + 1}}`, text: 'What happens then.' }}));
// Each date with the step under it, a line of its own the runtime writes (not the author's words).
const when = (list) => {{ const nodes = REGISTRY.get('timeline').render({{ id: 't', frame: {{ x: 60, y: 160, width: 1160, height: 300 }}, props: {{ items: list }} }}).nodes;
  const step = (stage) => nodes.find((n) => n.role === 'timeline-elapsed' && n.data.stage === stage)?.text;
  return nodes.filter((n) => n.role === 'timeline-when').map((n) => [n.text, step(n.data.stage)].filter(Boolean).join(' | ')); }};
console.log(JSON.stringify({{ steps: elapsedSteps(dates), when: when(items), even: when(['2024', '2025', '2026'].map((date) => ({{ date, label: date, text: 'x' }}))) }}));
""")
        self.assertEqual(result["steps"], [None, 18, 8, 2, 7, 31, 12, 60])
        said = " ".join(result["when"]).replace("\n", " ")
        self.assertIn("2035 | 5 years on", said)
        self.assertIn("Nov 2025 | 2 months on", said)
        self.assertEqual(result["even"], ["2024", "2025", "2026"])  # even steps say nothing


class PanelScaleTests(unittest.TestCase):
    def test_bars_beside_a_line_keep_their_own_scale_and_two_upright_charts_share_one(self):
        """BA retest fd01: ten margins from 2.5% to 15.8% took the -60% floor of a Covid line beside them and filled a quarter of their panel."""
        result = run_node(f"""
import {{ composeAll }} from '{RUNTIME}/compose-all.mjs';
const groups = ['Ryanair', 'IAG', 'Norwegian', 'Turkish', 'easyJet', 'SAS', 'AF-KLM', 'TAP', 'Lufthansa', 'Wizz'];
const years = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const bars = {{ type: 'chart.bar', heading: 'Operating margin, 2025', unit: '%', categories: groups, series: [{{ name: 'Margin', values: [15.8, 15.1, 9.9, 9.1, 7.0, 6.2, 6.1, 5.7, 4.9, 2.5] }}] }};
const line = {{ type: 'chart.line', heading: 'Operating margin, 2016-2025', unit: '%', categories: years, series: [{{ name: 'IAG', values: [11.4, 13.2, 13.3, 13.1, -55.8, -35.1, 5.4, 11.9, 13.8, 15.1] }}] }};
const columns = {{ type: 'chart.column', heading: 'Operating margin, 2025', unit: '%', categories: groups.slice(0, 6), series: [{{ name: 'Margin', values: [15.8, 15.1, 9.9, 9.1, 7.0, 6.2] }}] }};
const compose = (exhibits) => composeAll({{ schema: 'professional-slides.deck/v3', id: 't', design: 'consulting', cover: {{ title: 'T' }},
  slides: [{{ id: 'p1', title: 'IAG earned the highest margin of the network groups', arrange: 'row', exhibits }}] }}, '.', {{ partial: true }}).deck.slides.find((s) => s.id === 'p1');
const beside = compose([bars, line]);
const panel = beside.componentInstances.find((c) => c.component === 'chart.bar').frame;
const longest = Math.max(...beside.nodes.filter((n) => n.role === 'chart-mark' && n.frame.x < panel.x + panel.width).map((n) => n.frame.width));
// Two upright charts of one unit still share a scale: the columns stand on the line's zero, high over its Covid low.
const upright = compose([columns, line]);
const left = upright.componentInstances.find((c) => c.component === 'chart.column').frame;
const tallest = Math.max(...upright.nodes.filter((n) => n.role === 'chart-mark' && n.frame.x < left.x + left.width).map((n) => n.frame.height));
console.log(JSON.stringify({{ share: longest / panel.width, column: tallest / left.height }}));
""")
        self.assertGreater(result["share"], 0.5)   # the longest bar takes most of its panel, not the last quarter
        self.assertLess(result["column"], 0.35)    # columns beside the line still read on its -60 to 20 scale


if __name__ == "__main__":
    unittest.main()
