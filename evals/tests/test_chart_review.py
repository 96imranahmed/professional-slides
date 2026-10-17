"""The fundamental review of the chart code (October 2026), case by case.

A stress pass rendered every chart kind's sample and examples under awkward but ordinary inputs - negatives, zeros, flat
runs, outliers, forty members, long names, skipped years - at four frames, and read each scene the way the build does.
These are the faults it found that a reader would see, each held where it was fixed: the subject's colour, shared by
every kind; the axis jumps, shared; the sense check on a chart over time; and the labels placed together.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { resolveStyle, nativeChartSpec, TOKENS, THEME_SLOT_TOKENS } from './skills/professional-slides/runtime/core.mjs';
import { sceneDesignFindings, inkBox } from './skills/professional-slides/runtime/validate-overlap.mjs';
import { resolvePalette, groundTokens, PALETTES, contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const frame = { x: 60, y: 160, width: 760, height: 420 };
const draw = (kind, props, f = frame, palette = 'midnight') => withDesignTokens(resolvePalette(palette, TOKENS, THEME_SLOT_TOKENS).tokens,
  () => REGISTRY.get(kind).render({ id: 'c', frame: f, props }).nodes.map((n) => ({ ...n, style: resolveStyle(n.style || {}) })));
const blocking = (nodes) => sceneDesignFindings({ slides: [{ id: 's', nodes }] }).filter((f) => f.severity === 'blocker').map((f) => f.code);
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const years = (n, from = 2015) => Array.from({ length: n }, (_, i) => String(from + i));
"""


class SampleSweepTests(unittest.TestCase):
    def test_every_charts_own_examples_draw_clean(self):
        # The registry's samples and examples are what an author copies: each draws with no label on a label or a line.
        result = run_node(PRELUDE + """
const dirty = [];
for (const kind of [...REGISTRY.keys()].filter((id) => id.startsWith('chart.'))) {
  const entry = REGISTRY.get(kind);
  const cases = { sample: entry.sample?.props ?? entry.sample, ...Object.fromEntries(Object.entries(entry.examples || {}).map(([k, v]) => [k, v.props ?? v])) };
  for (const [name, props] of Object.entries(cases)) {
    if (!props || typeof props !== 'object') continue;
    // A sample may need a bigger frame than this one; it may never compare nothing.
    let nodes; try { nodes = draw(kind, structuredClone(props)); } catch (e) { if (/NO_COMPARISON|SERIES_FLAT|ONE_COMPARISON/.test(e.message)) dirty.push(`${kind}/${name}: ${e.message.slice(0, 80)}`); continue; }
    const found = blocking(nodes);
    if (found.length) dirty.push(`${kind}/${name}: ${[...new Set(found)].join(', ')}`);
  }
}
console.log(JSON.stringify({ dirty }));
""")
        self.assertEqual(result["dirty"], [])


class SubjectColourTests(unittest.TestCase):
    def test_the_subject_stands_apart_from_both_kinds_of_peer_on_every_palette_and_ground(self):
        result = run_node(PRELUDE + """
import { applyDesign, DESIGN_SYSTEMS } from './skills/professional-slides/runtime/design-systems.mjs';
const palettes = [...Object.keys(PALETTES).filter((p) => p !== 'toolkit'), ...Object.keys(DESIGN_SYSTEMS).map((d) => applyDesign({ design: d }).palette),
  applyDesign({ design: 'consulting', identity: { primary: '#111A2E', accent: '#A8543A' } }).palette];
const weak = [];
for (const palette of palettes) for (const ground of ['light', 'dark']) {
  const t = groundTokens(resolvePalette(palette, TOKENS, THEME_SLOT_TOKENS).tokens, ground, THEME_SLOT_TOKENS), v = (k) => t[k].value;
  // Its data peers take the peer colour (palettes.mjs peerOf), its context peers the comparator grey.
  const peer = contrastRatio(v('color.chartSubject'), v('color.chartPeer')), grey = contrastRatio(v('color.chartSubject'), v('color.chartComparator'));
  if (peer < 1.5 || grey < 3) weak.push(`${palette.id ?? palette} ${ground}: ${peer.toFixed(2)} / ${grey.toFixed(2)}`);
}
console.log(JSON.stringify({ weak }));
""")
        self.assertEqual(result["weak"], [])

    def test_a_slope_without_a_subject_draws_its_lines_in_the_lead_colour_and_honours_a_focus(self):
        result = run_node(PRELUDE + """
const series = [{ name: 'Dubai', values: [86, 95] }, { name: 'Heathrow', values: [81, 84] }, { name: 'Paris', values: [76, 72] }];
const strokes = (props) => [...new Set(draw('chart.slope', { categories: ['2019', '2025'], series, ...props }).filter((n) => n.role === 'chart-line').map((n) => n.style.stroke.tokenId))];
console.log(JSON.stringify({ plain: strokes({}), focus: strokes({ focusSeries: 'Heathrow' }) }));
""")
        self.assertEqual(result["plain"], ["color.chartSeries1"])  # every line data, none in the gridline grey
        self.assertEqual(sorted(result["focus"]), ["color.chartSubject", "color.rule"])

    def test_a_focus_lines_legend_keys_the_colours_the_lines_are_drawn_in(self):
        # The BA deck's unit-cost page keyed its lines in series colours and drew them navy and grey.
        result = run_node(PRELUDE + """
const nodes = draw('chart.line', { categories: years(5, 2019), focusSeries: 'Cost', legend: true, directLabels: 'legend',
  series: [{ name: 'Revenue', values: [6.7, 4.9, 4.8, 7.4, 8.0] }, { name: 'Cost', values: [4.8, 9.0, 7.8, 6.0, 5.7] }] });
const swatch = (name) => nodes.find((n) => n.role === 'legend-swatch' && n.data?.categoryKey === name);
const line = (name) => nodes.find((n) => n.role === 'chart-line' && n.id.includes(name.toLowerCase()));
console.log(JSON.stringify({ pairs: ['Revenue', 'Cost'].map((name) => [swatch(name)?.style.fill?.value ?? swatch(name)?.style.stroke?.value, line(name)?.style.stroke.value]) }));
""")
        for swatch, line in result["pairs"]:
            self.assertEqual(swatch, line)


class SenseCheckTests(unittest.TestCase):
    def test_a_run_that_barely_moves_is_refused_unless_it_is_set_against_a_reference(self):
        result = run_node(PRELUDE + """
const flat = { categories: years(8), series: [{ name: 'BA', values: [51, 51.5, 51.2, 51.8, 51.6, 51.9, 51.7, 51.8] }, { name: 'Virgin', values: [4.1, 4.2, 4.0, 4.3, 4.2, 4.3, 4.3, 4.3] }], yMin: 0 };
console.log(JSON.stringify({
  line: refusal(() => draw('chart.line', flat)), column: refusal(() => draw('chart.column', { categories: years(8), series: [{ name: 'Rate', values: [10.7, 10.9, 11.2, 11.0, 11.1, 10.8, 10.9, 11.3] }] })),
  referenced: refusal(() => draw('chart.column', { categories: years(8), series: [{ name: 'Rate', values: [10.7, 10.9, 11.2, 11.0, 11.1, 10.8, 10.9, 11.3] }], referenceLines: [{ value: 11, label: 'Target' }] })),
  twoPeriods: refusal(() => draw('chart.column', { categories: ['FY19', 'FY26'], series: [{ name: 'Branches', values: [42, 40] }] })),
  moving: refusal(() => draw('chart.line', { categories: years(8), series: [{ name: 'BA', values: [51, 49, 44, 30, 22, 38, 47, 52] }] })),
  onePeriod: refusal(() => draw('chart.line', { categories: ['2023'], series: [{ name: 'Profit', values: [367] }, { name: 'Excluding', values: [280] }] })) }));
""")
        self.assertIn("SERIES_FLAT", result["line"])
        self.assertIn("SERIES_FLAT", result["column"])
        self.assertIsNone(result["referenced"])
        self.assertIsNone(result["twoPeriods"])
        self.assertIsNone(result["moving"])
        self.assertIn("NO_COMPARISON", result["onePeriod"])

    def test_a_long_series_drawn_for_one_comparison_is_refused_unless_its_middle_says_something(self):
        result = run_node(PRELUDE + """
const change = { start: { category: '2015' }, end: { category: '2024' }, text: '+82%' };
const steady = { categories: years(10), series: [{ name: 'Revenue', values: [50, 54, 59, 63, 68, 72, 77, 82, 86, 91] }], changeAnnotations: [change] };
console.log(JSON.stringify({
  steady: refusal(() => draw('chart.column', steady)),
  dip: refusal(() => draw('chart.column', { ...steady, series: [{ name: 'Revenue', values: [50, 54, 59, 63, 68, 20, 41, 82, 86, 91] }] })),
  marked: refusal(() => draw('chart.column', { ...steady, annotations: [{ category: '2020', text: 'A new market opens' }] })),
  short: refusal(() => draw('chart.column', { ...steady, categories: years(4), series: [{ name: 'Revenue', values: [50, 64, 77, 91] }], changeAnnotations: [{ ...change, end: { category: '2018' } }] })) }));
""")
        self.assertIn("ONE_COMPARISON", result["steady"])
        self.assertIsNone(result["dip"])
        self.assertIsNone(result["marked"])
        self.assertIsNone(result["short"])


class AxisJumpTests(unittest.TestCase):
    def test_lines_over_a_data_table_break_their_axis_and_multiples_set_dates_where_they_fall(self):
        result = run_node(PRELUDE + """
const categories = ['2015', '2017', '2018', '2019', '2023', '2024', '2025'];
const line = draw('chart.line', { categories, categoryColumns: { label: 80 }, dataLabels: false, series: [{ name: 'Seats', values: [40, 44, 46, 48, 30, 42, 47] }] });
const multiples = draw('chart.small-multiples', { mark: 'line', categories, items: [{ label: 'A', values: [40, 44, 46, 48, 30, 42, 47] }, { label: 'B', values: [20, 24, 27, 30, 12, 22, 28] }] });
const segments = multiples.filter((n) => n.role === 'chart-line' && n.data?.item === 'A');
const x = (i) => segments.find((n) => n.id.endsWith(`segment:${i}`))?.data;
console.log(JSON.stringify({ breaks: line.filter((n) => n.role === 'chart-break').map((n) => n.data.after), segments: segments.length,
  wider: x(0) && x(1) ? (x(0).x2 - x(0).x1) > (x(1).x2 - x(1).x1) * 1.5 : null }));
""")
        self.assertEqual(result["breaks"], ["2015", "2019"])
        self.assertEqual(result["segments"], 4)  # none across 2016 or 2020-22
        self.assertIsNone(result["wider"])  # the 2015-2017 segment is not drawn at all

    def test_a_lone_line_broken_at_a_gap_keeps_a_bare_stroke(self):
        # Filled run by run, the BA deck's low-cost share drew two slabs that read as columns.
        result = run_node(PRELUDE + """
const fills = (categories) => draw('chart.line', { categories, yMin: 0, series: [{ name: 'Share', values: [30.3, 31.9, 32.5, 34.5, 35.2] }] }).filter((n) => n.role === 'chart-area').length;
console.log(JSON.stringify({ gapped: fills(['2018', '2019', '2022', '2024', '2025']), even: fills(['2021', '2022', '2023', '2024', '2025']) }));
""")
        self.assertEqual(result["gapped"], 0)
        self.assertEqual(result["even"], 1)


class LabelTests(unittest.TestCase):
    def test_line_labels_are_placed_together_clear_of_each_other_and_the_axis(self):
        result = run_node(PRELUDE + """
const cases = {
  crossing: { categories: years(6), series: [{ name: 'Plan', values: [-3, 4, -2, 5, -1, 6] }, { name: 'Actual', values: [-2.8, 4.2, -2.1, 5.2, -1.1, 6.1] }] },
  zeros: { categories: years(8, 2013), series: [{ name: 'Pairs', values: [5, 7, 8, 2, 2.7, 0, 0, 1] }] } };
const out = {};
for (const [name, props] of Object.entries(cases)) {
  const nodes = draw('chart.line', props);
  const axisTop = Math.min(...nodes.filter((n) => n.role === 'category-label').map((n) => inkBox(n).y));
  const low = nodes.filter((n) => n.role === 'data-label').some((n) => inkBox(n).y + inkBox(n).height > axisTop);
  out[name] = { findings: blocking(nodes), low };
}
console.log(JSON.stringify(out));
""")
        for name, case in result.items():
            self.assertEqual(case["findings"], [], name)
            self.assertFalse(case["low"], name)

    def test_crowded_columns_and_long_names_and_negative_stems_read_cleanly(self):
        result = run_node(PRELUDE + """
const forty = Array.from({ length: 40 }, (_, i) => 'Op' + (i + 1));
const columns = draw('chart.column', { categories: forty, series: [{ name: 'm', values: forty.map((_, i) => 100 + i * 7) }] }, { x: 60, y: 160, width: 380, height: 300 });
const names = ['Lufthansa Group mainline and regional airlines', 'Air France-KLM Group mainline and regional', 'International Airlines Group', 'Ryanair Holdings group'];
const bars = draw('chart.bar', { categories: names, series: [{ name: 'Margin', values: [4.9, 6.1, 15.1, 15.8] }] });
const stems = draw('chart.lollipop', { categories: names, series: [{ name: 'Change', values: [-24, -11, 3, 37] }] });
const inside = (nodes) => nodes.filter((n) => n.role === 'category-label').every((n) => inkBox(n).x >= frame.x - 1);
console.log(JSON.stringify({ columns: { labels: columns.filter((n) => n.role === 'data-label').length, axis: columns.some((n) => n.role === 'axis-label'), findings: blocking(columns) },
  bars: { inside: inside(bars), findings: blocking(bars) }, stems: { inside: inside(stems), findings: blocking(stems) } }));
""")
        self.assertEqual(result["columns"], {"labels": 0, "axis": True, "findings": []})  # read off an axis, not forty colliding values
        self.assertEqual(result["bars"], {"inside": True, "findings": []})
        self.assertEqual(result["stems"], {"inside": True, "findings": []})

    def test_end_labels_and_reference_rules_give_way(self):
        result = run_node(PRELUDE + """
const area = draw('chart.stacked-area', { categories: years(6), series: [{ name: 'Long-haul', values: [40, 42, 44, 45, 46, 48] }, { name: 'Storage', values: [1, 1, 2, 1, 2, 1] }, { name: 'Electronics', values: [1, 2, 1, 2, 1, 2] }] });
const multiples = draw('chart.small-multiples', REGISTRY.get('chart.small-multiples').sample);
const combo = draw('chart.combo', REGISTRY.get('chart.combo').sample);
console.log(JSON.stringify({ area: blocking(area), multiples: blocking(multiples), combo: blocking(combo) }));
""")
        self.assertEqual(result, {"area": [], "multiples": [], "combo": []})


class PlacedValueTests(unittest.TestCase):
    def test_a_value_takes_its_next_clear_place_and_may_sit_on_its_own_bar(self):
        result = run_node(PRELUDE + """
import { placeLabels } from './skills/professional-slides/runtime/label-placement.mjs';
const bar = { x: 100, y: 100, width: 60, height: 200 }, neighbour = { x: 100, y: 60, width: 60, height: 36 };
const label = (own) => ({ text: '1,250', own, frames: [{ x: 100, y: 70, width: 60, height: 24 }, { x: 100, y: 106, width: 60, height: 24 }] });
const style = () => ({ fontFamily: 'Arial', fontSize: 12, color: '#000000', align: 'center' });
const free = placeLabels([label(bar)], { style, keepOut: [bar, neighbour] });
const blocked = placeLabels([label(null)], { style, keepOut: [bar, neighbour] });
console.log(JSON.stringify({ free: free.placed.map((l) => l.frame.y), blocked: blocked.dropped }));
""")
        self.assertEqual(result, {"free": [106], "blocked": 1})  # over the bar is taken, so inside it; never on a bar not its own

    def test_values_a_chart_insists_on_are_refused_when_they_cannot_be_placed(self):
        result = run_node(PRELUDE + """
const members = Array.from({ length: 24 }, (_, i) => 'M' + i);
const crowded = { categories: members, series: [{ name: 'a', values: members.map((_, i) => 1000 + i) }, { name: 'b', values: members.map((_, i) => 900 + i) }] };
const read = draw('chart.column', crowded);
console.log(JSON.stringify({ insists: refusal(() => draw('chart.column', { ...crowded, dataLabels: true })),
  read: { labels: read.filter((n) => n.role === 'data-label').length, axis: read.some((n) => n.role === 'axis-label'), findings: blocking(read) } }));
""")
        self.assertIn("asks for every one (dataLabels: true)", result["insists"])
        self.assertEqual(result["read"], {"labels": 0, "axis": True, "findings": []})

    def test_wide_ticks_widen_the_gutter_and_dense_periods_are_named_clear_of_each_other(self):
        result = run_node(PRELUDE + """
const wide = draw('chart.column', { categories: years(4, 2021), series: [{ name: 'Seats', values: [900000, 1600000, 2100000, 2500000] }], dataLabels: false, gridlines: true });
const months = Array.from({ length: 24 }, (_, i) => `M${String(i + 1).padStart(2, '0')}-25`);
const area = draw('chart.stacked-area', { categories: months, series: [{ name: 'A', values: months.map((_, i) => 20 + i) }, { name: 'B', values: months.map((_, i) => 10 + (i % 5)) }] });
const combo = draw('chart.combo', { categories: months, series: [{ name: 'Revenue', values: months.map((_, i) => 100 + i * 3) }, { name: 'Margin', values: months.map((_, i) => 10 + (i % 4)) }] });
const dated = draw('chart.column', { categories: ['2015', '2017', '2018', '2019', '2023', '2024', '2025'], series: [{ name: 'm', values: [52, 68, 75, 53, 70, 76, 55] }] }, { x: 60, y: 160, width: 380, height: 300 });
const named = (nodes) => nodes.filter((n) => n.role === 'category-label').map((n) => n.text);
console.log(JSON.stringify({ gutter: wide.filter((n) => n.role === 'axis-label').every((n) => inkBox(n).x >= frame.x - 1),
  area: { named: named(area).length, first: named(area)[0], findings: blocking(area) }, combo: { named: named(combo).length, findings: blocking(combo) },
  dated: { named: named(dated), findings: blocking(dated) } }));
""")
        self.assertTrue(result["gutter"])  # "2,500,000" sits inside the frame, not off its left edge
        self.assertEqual(result["area"]["findings"], [])
        self.assertEqual(result["area"]["first"], "M01-25")
        self.assertLess(result["area"]["named"], 24)
        self.assertEqual(result["combo"]["findings"], [])
        self.assertLess(result["combo"]["named"], 24)
        self.assertEqual(result["dated"]["findings"], [])
        self.assertIn("2015", result["dated"]["named"])
        self.assertLess(len(result["dated"]["named"]), 7)


class GapTests(unittest.TestCase):
    def test_a_line_and_its_columns_leave_a_gap_where_a_series_has_no_value(self):
        result = run_node(PRELUDE + """
const props = { categories: years(5, 2021), series: [{ name: 'Holidays', values: [10, 12, null, 15, 17] }, { name: 'Group', values: [30, 34, 37, 41, 44] }] };
const line = draw('chart.line', props);
const columns = draw('chart.column', props);
const ofA = (nodes, role) => nodes.filter((n) => n.role === role && n.data?.series === 'Holidays');
console.log(JSON.stringify({ segments: line.filter((n) => n.id.startsWith('c:segment:holidays:')).length, labels: ofA(line, 'data-label').map((n) => n.data.category),
  native: nativeChartSpec('chart.line', props, frame, line) === null, bars: ofA(columns, 'chart-mark').map((n) => n.data.category),
  findings: [...blocking(line), ...blocking(columns)], area: refusal(() => draw('chart.area', props)) }));
""")
        self.assertEqual(result["segments"], 2)  # 2021-22 and 2024-25: nothing drawn across 2023
        self.assertNotIn("2023", result["labels"])
        self.assertTrue(result["native"])  # the native chart cannot leave the gap, so the drawn one stands
        self.assertEqual(result["bars"], ["2021", "2022", "2024", "2025"])
        self.assertEqual(result["findings"], [])
        self.assertIn("no value for", result["area"])


class ExhibitKeyTests(unittest.TestCase):
    def test_a_key_nothing_reads_is_refused_and_a_note_of_ones_own_is_not(self):
        tmp = Path(tempfile.mkdtemp(prefix="unread-keys-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        examples = ROOT / "skills" / "professional-slides" / "examples"
        shutil.copytree(examples / "assets", tmp / "assets")
        doc = json.loads((examples / "page-forms.pages.json").read_text())
        doc["pages"] = [page for page in doc["pages"] if page["id"] in ("f-trend-target-band", "f-ranking-side-title")]
        doc.pop("appendix", None)
        band, side = doc["pages"]
        band["exhibit"]["marks"] = {"referenceLines": [{"value": 50, "label": "Target"}]}
        band["exhibit"]["peers"] = ["Peer"]
        side["exhibit"]["$why"] = "a note of the author's own"
        (tmp / "u.pages.json").write_text(json.dumps(doc))
        run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "u.pages.json"), "--check"], capture_output=True, text=True)
        out = run.stdout + run.stderr
        self.assertEqual(run.returncode, 2)
        self.assertEqual(out.count("EXHIBIT_KEY_UNREAD"), 2)
        self.assertIn("`exhibit.marks` is no field of chart.line - a mark is written at the exhibit's top level", out)
        self.assertIn("`exhibit.peers` is no field of chart.line", out)
        self.assertNotIn("$why", out)

    def test_a_labelled_rows_block_exhibit_is_read_for_unread_keys_too(self):
        tmp = Path(tempfile.mkdtemp(prefix="unread-block-keys-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        examples = ROOT / "skills" / "professional-slides" / "examples"
        shutil.copytree(examples / "assets", tmp / "assets")
        doc = json.loads((examples / "page-types.pages.json").read_text())
        doc["pages"] = [page for page in doc["pages"] if page["id"] == "p24b"]
        doc.pop("appendix", None)
        doc["pages"][0]["blocks"][0]["exhibit"]["typoOption"] = True
        (tmp / "b.pages.json").write_text(json.dumps(doc))
        run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "b.pages.json"), "--check"], capture_output=True, text=True)
        out = run.stdout + run.stderr
        self.assertEqual(run.returncode, 2)
        self.assertIn("`blocks[0].exhibit.typoOption` is no field of chart.column", out)

    def test_a_table_column_can_set_its_rates_in_a_bubble(self):
        # A growth rate or a margin beside counts reads as one: the worked lookup table sets its CAGR column as pills.
        doc = json.loads((ROOT / "skills" / "professional-slides" / "examples" / "page-forms.pages.json").read_text())
        table = next(page for page in doc["pages"] if page["id"] == "f-lookup-table")
        self.assertIn({"label": "Growth FY23-FY26", "bubble": True}, table["exhibit"]["columns"])
        self.assertIn("bubble", (ROOT / "skills" / "professional-slides" / "references" / "drawing.md").read_text())


class ReviewRefusalTests(unittest.TestCase):
    def test_a_trellis_takes_a_whole_column_count_prints_a_zero_share_as_zero_and_refuses_a_panel_of_gaps(self):
        result = run_node(PRELUDE + """
const two = [{ label: 'A', values: [1, 2] }, { label: 'B', values: [2, 3] }];
const columns = [0, 1.5, '2', 3].map((n) => refusal(() => draw('chart.small-multiples', { mark: 'column', columns: n, categories: ['a', 'b'], items: two })));
const gaps = refusal(() => draw('chart.small-multiples', { mark: 'line', reference: 'average', categories: ['a', 'b', 'c'], items: [{ label: 'A', values: [1, 2, 3] }, { label: 'B', values: [null, null, null] }] }));
const donut = draw('chart.small-multiples', { mark: 'donut', centre: 'X', categories: ['X', 'Y', 'Z'], items: [{ label: 'A', values: [0, 3, 4] }, { label: 'B', values: [0.2, 50, 49.8] }] }, { x: 60, y: 160, width: 1160, height: 480 });
const centres = donut.filter((n) => n.role === 'chart-centre-value').map((n) => n.text);
console.log(JSON.stringify({ columns, two: draw('chart.small-multiples', { mark: 'column', columns: 2, categories: ['a', 'b'], items: two }).length > 0, gaps, centres }));
""")
        self.assertTrue(all(message and "a whole number from 1 to the 2 panels" in message for message in result["columns"]))
        self.assertTrue(result["two"])
        self.assertIn("gaps alone", result["gaps"])
        self.assertEqual(result["centres"], ["0%", "<1%"])

    def test_a_horizontal_bridge_refuses_the_scale_it_does_not_draw(self):
        result = run_node(PRELUDE + """
const props = { orientation: 'horizontal', categories: ['FY24', 'Price', 'Volume', 'FY25'], values: [100, 12, -5, 107], totals: [0, 3] };
console.log(JSON.stringify({ plain: draw('chart.waterfall', props).length > 0, without: draw('chart.waterfall', { ...props, gridlines: false, showValueAxis: false }).length > 0,
  gridlines: refusal(() => draw('chart.waterfall', { ...props, gridlines: true })), axis: refusal(() => draw('chart.waterfall', { ...props, showValueAxis: true })), typed: refusal(() => draw('chart.waterfall', { ...props, gridlines: 'yes' })) }));
""")
        self.assertTrue(result["plain"])
        self.assertTrue(result["without"])
        self.assertIn("draws no value axis or gridlines - drop `gridlines`", result["gridlines"])
        self.assertIn("drop `showValueAxis`", result["axis"])
        self.assertIn("gridlines must be true or false", result["typed"])


class CapsuleTests(unittest.TestCase):
    def test_a_capsules_words_sit_midway_between_its_number_and_its_icon(self):
        # Set under the number, the words left the foot of each tall pillar an empty dark slab (the BA deck's UBS page).
        result = run_node(PRELUDE + """
import { capsulesNodes } from './skills/professional-slides/runtime/figures.mjs';
const items = [{ title: 'Spatial tasks', text: 'Notes attached to artifacts', icon: 'map-pin' }, { title: 'Multi-human work', text: 'Concurrent edits and ownership of artifacts across a team', icon: 'people' }];
const nodes = capsulesNodes({ id: 'k', frame: { x: 60, y: 160, width: 1160, height: 460 }, props: { items } });
const of = (role) => nodes.filter((n) => n.role === role);
const body = of('capsule-body')[0].frame, number = of('capsule-number').find((n) => n.frame).frame, icon = of('capsule-icon-glyph')[0].frame;
const titles = of('capsule-title').map((n) => n.frame.y), texts = of('capsule-text');
const wordsTop = titles[0], wordsBottom = Math.max(...texts.map((n) => n.frame.y + n.frame.height));
console.log(JSON.stringify({ aligned: new Set(titles).size === 1, above: wordsTop - (number.y + number.height), below: icon.y - wordsBottom, tall: body.height }));
""")
        self.assertTrue(result["aligned"])
        self.assertGreater(result["tall"], 400)  # still a pillar
        self.assertLess(abs(result["above"] - result["below"]), 60)  # the words in the middle of the space, not under the number


class FileTests(unittest.TestCase):
    def test_axis_ticks_group_thousands_an_area_with_values_stays_drawn_and_a_unit_chart_must_fit(self):
        result = run_node(PRELUDE + """
import { axisTickText } from './skills/professional-slides/runtime/chart-axes.mjs';
const props = { categories: years(6), series: [{ name: 'Pairs', values: [5, 7, 8, 2, 3, 4] }] };
const area = draw('chart.area', props);
console.log(JSON.stringify({ tick: axisTickText(0, 12000, 4, 4), native: nativeChartSpec('chart.area', props, frame, area) === null,
  waffle: refusal(() => draw('chart.waffle', { categories: ['A', 'B'], series: [{ name: 'n', values: [1800000, 900000] }] })) }));
""")
        self.assertEqual(result["tick"], "12,000")
        self.assertTrue(result["native"])
        self.assertIn("one dot a unit", result["waffle"])


if __name__ == "__main__":
    unittest.main()
