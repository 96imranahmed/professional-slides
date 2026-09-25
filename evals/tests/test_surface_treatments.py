"""Surface treatments and the scene's ink estimate.

Analytical pages drawn as type on the canvas with hairlines - an open table,
white cards outlined on a cream page, one thin line across an empty plot,
roadmap dots on a rail - carried a median of 0.18 of their body as ink where
strong decks carry about 0.26, at the same word count. The surfaces are the
default now, every fill keeps the type on it legible, and the author hears the
estimate before the render.
"""
import sys
import unittest
from pathlib import Path

from node_probe import run_node

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402
import scene_ink  # noqa: E402

RENDER = r'''
import { TOKENS, THEME_SLOT_TOKENS, tokenValue } from './skills/professional-slides/runtime/core.mjs';
import { resolvePalette, contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
import { applyDesign } from './skills/professional-slides/runtime/design-systems.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const tokensFor = (spec) => resolvePalette(applyDesign({ id: 't', slides: [], ...spec }).palette ?? 'midnight', TOKENS, THEME_SLOT_TOKENS).tokens;
const render = (spec, component, props, frame = { x: 60, y: 160, width: 1160, height: 480 }) => {
  const tokens = tokensFor(spec);
  return withDesignTokens(tokens, () => {
    const nodes = REGISTRY.get(component).render({ id: 'x', frame, tokens, props }).nodes;
    const value = (v) => v && typeof v === 'object' && 'tokenId' in v ? tokenValue(v) : v;
    return nodes.map((n) => ({ role: n.role, type: n.type, frame: n.frame, data: n.data,
      fill: value(n.style?.fill), stroke: value(n.style?.stroke), color: value(n.style?.color),
      fillToken: n.style?.fill?.tokenId, lineToken: n.style?.lineWidth?.tokenId }));
  });
};
'''


class SurfaceTokenTests(unittest.TestCase):
    def test_every_system_takes_the_reference_weight_and_the_journal_keeps_its_character(self):
        result = run_node('''
import { applyDesign, DESIGN_NAMES, SURFACES } from './skills/professional-slides/runtime/design-systems.mjs';
import { TOKENS } from './skills/professional-slides/runtime/core.mjs';
const out = { defaults: Object.fromEntries(Object.keys(SURFACES.reference).map((k) => [k, TOKENS[k].value])), sets: SURFACES };
for (const design of DESIGN_NAMES) out[design] = applyDesign({ id: 'd', design, slides: [] }).palette.colors;
out.open = applyDesign({ id: 'd', surfaces: 'open', slides: [] }).palette.colors;
console.log(JSON.stringify(out));
''')
        # With no design at all the deck still gets the reference weight.
        self.assertEqual(result["defaults"], result["sets"]["reference"])
        for design in ("consulting", "editorial", "keynote"):
            for key, value in result["sets"]["reference"].items():
                self.assertEqual(result[design][key], value, (design, key))
        self.assertEqual(result["journal"]["style.cards"], "outline")
        self.assertEqual(result["journal"]["style.tableLabels"], "plain")
        self.assertEqual(result["journal"]["style.tableHeader"], "band")
        for key, value in result["sets"]["open"].items():
            self.assertEqual(result["open"][key], value, key)

    def test_the_filled_surface_shows_against_every_page_and_keeps_type_legible(self):
        result = run_node('''
import { TOKENS, THEME_SLOT_TOKENS, readableOn, tokenValue } from './skills/professional-slides/runtime/core.mjs';
import { resolvePalette, contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
import { applyDesign, DESIGN_NAMES } from './skills/professional-slides/runtime/design-systems.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const grey = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [.299, .587, .114][i], 0);
const out = [];
const palettes = ['midnight', 'evergreen', 'crimson', 'graphite'];
for (const design of DESIGN_NAMES) for (const identity of [undefined, { primary: '#C8102E', accent: '#C49A6C' }]) palettes.push(applyDesign({ id: 'd', design, identity, slides: [] }).palette);
for (const palette of palettes) {
  const tokens = resolvePalette(palette, TOKENS, THEME_SLOT_TOKENS).tokens;
  const tint = tokens['color.surfaceTint'].value, canvas = tokens['color.canvas'].value;
  withDesignTokens(tokens, () => out.push({
    delta: grey(canvas) - grey(tint),
    ink: contrastRatio(tokens['color.ink'].value, tint),
    readable: ['color.textSecondary', 'color.accent', 'color.componentPrimary'].map((id) => contrastRatio(tokenValue(readableOn({ tokenId: id }, { tokenId: 'color.surfaceTint' })), tint)),
    header: contrastRatio(tokens['color.onPrimary'].value, tokens['color.ink'].value),
  }));
}
console.log(JSON.stringify(out));
''')
        for row in result:
            # Clear of the rendered measure's 25-level threshold: a knife-edge
            # tint is exactly the surface nobody can predict.
            self.assertGreaterEqual(row["delta"], 28, row)
            self.assertLessEqual(row["delta"], 40, row)
            self.assertGreaterEqual(row["ink"], 7, row)
            for ratio in row["readable"]:
                self.assertGreaterEqual(ratio, 4.5, row)
            self.assertGreaterEqual(row["header"], 4.5, row)


class SurfaceComponentTests(unittest.TestCase):
    def test_an_open_table_takes_a_filled_header_and_a_filled_label_column(self):
        result = run_node(RENDER + '''
const props = { columns: ['Carrier', 'Claim', 'Why it cannot be ranked'], rows: [['Emirates', '152 cities', 'A year-end snapshot'], ['Qatar', '160 gateways', 'Seasonal schedules'], ['Etihad', '110 destinations', 'Includes planned services']] };
const ref = render({ design: 'editorial', identity: { primary: '#C8102E' } }, 'table', props);
const open = render({ surfaces: 'open' }, 'table', props);
const own = render({}, 'table', { ...props, headerBand: false, labelColumn: false });
const band = ref.find((n) => n.role === 'table-header-cell').fill, tint = ref.find((n) => n.role === 'table-label-column').fill;
const labels = ref.filter((n) => n.role === 'table-cell-text' && n.data.column === 0);
const contrast = [...ref.filter((n) => n.role === 'table-header-text').map((n) => contrastRatio(n.color, band)), ...labels.map((n) => contrastRatio(n.color, tint))];
console.log(JSON.stringify({ ref, open, own, contrast }));
''')
        ref = result["ref"]
        headers = [n for n in ref if n["role"] == "table-header-cell"]
        self.assertEqual(len(headers), 3)
        self.assertEqual(len(result["contrast"]), 6)
        self.assertTrue(all(r >= 4.5 for r in result["contrast"]), result["contrast"])
        column = [n for n in ref if n["role"] == "table-label-column"]
        self.assertEqual(len(column), 1)
        self.assertEqual(column[0]["fillToken"], "color.surfaceTint")
        # The last header cell stops where the rules do, the rest abut.
        rules = [n for n in ref if n["role"] == "table-rule"]
        self.assertLessEqual(headers[-1]["frame"]["x"] + headers[-1]["frame"]["width"], max(r["frame"]["x"] + r["frame"]["width"] for r in rules) + 0.01)
        for construction in ("open", "own"):
            roles = {n["role"] for n in result[construction]}
            self.assertNotIn("table-header-cell", roles, construction)
            self.assertNotIn("table-label-column", roles, construction)

    def test_cards_are_filled_blocks_unless_the_house_outlines_them(self):
        result = run_node(RENDER + '''
const props = { tone: 'outline', items: [{ title: 'Passengers', value: '15.7m', text: 'Carried in 2025' }, { title: 'Departures', value: '126,604', text: 'Two thirds as many' }, { title: 'Destinations', value: '140', text: 'In 58 countries' }] };
const pick = (nodes) => nodes.filter((n) => n.role === 'card-surface' || n.role === 'card-value');
console.log(JSON.stringify({ ref: pick(render({ design: 'editorial', identity: { primary: '#C8102E' } }, 'cards', props, { x: 60, y: 160, width: 1160, height: 300 })),
  journal: pick(render({ design: 'journal' }, 'cards', props, { x: 60, y: 160, width: 1160, height: 300 })) }));
''')
        surfaces = [n for n in result["ref"] if n["role"] == "card-surface"]
        self.assertEqual({n["fillToken"] for n in surfaces}, {"color.surfaceTint"})
        self.assertTrue(all(n["stroke"] in (None, "none") for n in surfaces))
        journal = [n for n in result["journal"] if n["role"] == "card-surface"]
        self.assertEqual({n["fillToken"] for n in journal}, {"color.surface"})

    def test_a_lone_line_takes_weight_and_an_area_and_two_lines_do_not(self):
        result = run_node(RENDER + '''
const cats = ['FY17', 'FY18', 'FY19', 'FY20', 'FY21', 'FY22'];
const one = render({}, 'chart.line', { categories: cats, series: [{ name: 'Cargo', values: [2.5, 2.6, 2.7, 2.4, 1.9, 2.1] }] });
const two = render({}, 'chart.line', { categories: cats, series: [{ name: 'A', values: [1, 2, 3, 4, 5, 6] }, { name: 'B', values: [2, 3, 3, 4, 4, 5] }] });
const light = render({ surfaces: 'open' }, 'chart.line', { categories: cats, series: [{ name: 'Cargo', values: [2.5, 2.6, 2.7, 2.4, 1.9, 2.1] }] });
const summary = (nodes) => ({ areas: nodes.filter((n) => n.role === 'chart-area').map((n) => n.data.lone ?? false),
  lines: [...new Set(nodes.filter((n) => n.role === 'chart-line').map((n) => n.lineToken))],
  markers: [...new Set(nodes.filter((n) => n.role === 'chart-marker').map((n) => n.frame.width))] });
console.log(JSON.stringify({ one: summary(one), two: summary(two), light: summary(light) }));
''')
        self.assertEqual(result["one"], {"areas": [True], "lines": ["line.medium"], "markers": [12]})
        self.assertEqual(result["two"]["areas"], [])
        self.assertEqual(result["two"]["lines"], ["line.medium"])
        self.assertEqual(result["light"], {"areas": [], "lines": ["line.standard"], "markers": [10]})

    def test_a_lone_line_drawn_natively_drops_its_area_from_the_scene_too(self):
        result = run_node('''
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const frame = { x: 60, y: 120, width: 1160, height: 450 };
const props = { categories: ['0', '12', '24', '36'], series: [{ name: 'Support', values: [0, 6, 12, 18] }], endLabels: true };
const nodes = REGISTRY.get('chart.line').render({ id: 'line', frame, props }).nodes;
console.log(JSON.stringify({ area: nodes.some((n) => n.role === 'chart-area' && n.data.lone), native: nativeChartSpec('chart.line', props, frame, nodes) !== null }));
''')
        # The render draws the area; the chart still goes native, and compile
        # (core.mjs) then drops the area the native chart cannot carry.
        self.assertEqual(result, {"area": True, "native": True})

    def test_dumbbell_dots_grow_and_alternate_rows_are_banded(self):
        result = run_node(RENDER + '''
const props = { categories: ['Europe', 'Asia', 'Americas', 'Africa'], series: [{ name: '2025', values: [38, 34, 21, 10] }, { name: '2026', values: [40, 36, 22, 11] }] };
const nodes = render({}, 'chart.dumbbell', props);
console.log(JSON.stringify({ bands: nodes.filter((n) => n.role === 'chart-row-band').length, dots: [...new Set(nodes.filter((n) => n.role === 'chart-mark').map((n) => n.frame.width))],
  bar: [...new Set(nodes.filter((n) => n.role === 'chart-line').map((n) => n.lineToken))] }));
''')
        self.assertEqual(result, {"bands": 2, "dots": [18], "bar": ["line.medium"]})

    def test_roadmap_stages_are_headed_by_filled_phase_blocks(self):
        result = run_node(RENDER + '''
const props = { variant: 'wave-columns', items: [{ range: 'Oct 2024', heading: 'Narrowbody order', activities: ['60 A321neo firm'] }, { range: 'Jun 2025', heading: 'Launch', activities: ['Three 787-9'] }, { range: 'Sep 2026', heading: 'Network', activities: ['14 outstations'] }] };
const nodes = render({}, 'roadmap', props);
const light = render({ surfaces: 'open' }, 'roadmap', props);
const blocks = nodes.filter((n) => n.role === 'roadmap-phase-surface');
const headings = nodes.filter((n) => n.role === 'roadmap-heading');
console.log(JSON.stringify({ blocks: blocks.length, fill: [...new Set(blocks.map((n) => n.fillToken))], inside: headings.every((h, i) => h.frame.x >= blocks[i].frame.x && h.frame.x + h.frame.width <= blocks[i].frame.x + blocks[i].frame.width && Math.abs((h.frame.y + h.frame.height / 2) - (blocks[i].frame.y + blocks[i].frame.height / 2)) < 0.5),
  rail: nodes.find((n) => n.role === 'roadmap-rail').lineToken, lightBlocks: light.filter((n) => n.role === 'roadmap-phase-surface').length }));
''')
        self.assertEqual(result, {"blocks": 3, "fill": ["color.surfaceTint"], "inside": True, "rail": "line.medium", "lightBlocks": 0})


def slide(nodes, instances=None, task="chart-led", canvas="#FFFFFF"):
    return {"id": "s", "readingTask": task, "tokens": {"color.canvas": {"value": canvas}},
            "componentInstances": instances if instances is not None else [{"component": "slide-chrome"}, {"component": "chart.line", "category": "chart"}],
            "nodes": nodes}


def rect(x, y, w, h, fill):
    return {"type": "rect", "role": "box", "frame": {"x": x, "y": y, "width": w, "height": h}, "style": {"fill": {"value": fill}, "stroke": "none"}}


def text(x, y, w, lines, size=12, color="#000000"):
    return {"type": "text", "role": "paragraph", "text": "\n".join(lines), "frame": {"x": x, "y": y, "width": w, "height": 16 * len(lines)},
            "style": {"fontSize": {"value": size}, "color": {"value": color}, "lineHeight": 16},
            "data": {"textLayout": {"lines": lines, "width": w, "lineHeight": 16}}}


class SceneInkTests(unittest.TestCase):
    def test_the_estimate_reads_what_the_render_counts(self):
        body = (720 * 0.92 - 720 * 0.15) * 1280
        self.assertEqual(scene_ink.estimate(slide([])), 0.0)
        # A dark block is ink by its area; one hairline across the page is not.
        block = scene_ink.estimate(slide([rect(0, 200, 1280, 100, "#051C2C")]))
        self.assertAlmostEqual(block, 1280 * 100 / body, delta=0.02)
        self.assertEqual(scene_ink.estimate(slide([{"type": "line", "role": "rule", "frame": {"x": 60, "y": 300, "width": 1160, "height": 0},
                                                     "style": {"stroke": {"value": "#929BA3"}, "lineWidth": {"value": 1}}, "data": {"x1": 60, "y1": 300, "x2": 1220, "y2": 300}}])), 0.0)
        # A tint a few levels off the page is air; the filled surface is not.
        self.assertEqual(scene_ink.estimate(slide([rect(60, 200, 400, 200, "#F0F0F0")])), 0.0)
        self.assertGreater(scene_ink.estimate(slide([rect(60, 200, 400, 200, "#DCDFE1")])), 0.05)
        # Lines of type count by their glyph band and width.
        prose = scene_ink.estimate(slide([text(60, 200, 1000, ["A line of body copy"] * 12)]))
        self.assertGreater(prose, 0.05)
        self.assertLess(prose, 0.3)
        # A disc is filled as a disc, not spread thin over its box.
        disc = {"type": "ellipse", "role": "cycle-hub", "frame": {"x": 400, "y": 200, "width": 200, "height": 200}, "style": {"fill": {"value": "#DCDFE1"}}}
        self.assertAlmostEqual(scene_ink.estimate(slide([disc])), 3.1416 * 100 * 100 / body, delta=0.01)

    def test_a_light_exhibit_page_is_named_and_a_page_of_prose_is_not(self):
        findings = []
        page_gates.gate_scene_ink(1, slide([text(60, 200, 600, ["Label"] * 2)]), findings)
        self.assertEqual([f["code"] for f in findings], ["SCENE_INK"])
        self.assertIn("rather than adding words", findings[0]["repair"])
        prose = []
        page_gates.gate_scene_ink(1, slide([text(60, 200, 600, ["Label"] * 2)], instances=[{"component": "paragraph"}], task="text-page"), prose)
        self.assertEqual(prose, [])
        weighted = []
        page_gates.gate_scene_ink(1, slide([rect(60, 200, 1160, 300, "#051C2C")]), weighted)
        self.assertEqual(weighted, [])

    def test_a_light_deck_is_named_once(self):
        light = [slide([text(60, 200, 600, ["Label"] * 3)]) for _ in range(12)]
        findings = []
        page_gates.gate_deck_ink(light, list(range(1, 12)), findings)
        self.assertEqual(findings, [], "under twelve analytical pages the deck is not judged")
        page_gates.gate_deck_ink([slide([])] + light, list(range(1, 13)), findings)
        self.assertEqual([f["code"] for f in findings], ["DECK_INK"])
        heavy = [slide([rect(60, 200, 1160, 300, "#051C2C")]) for _ in range(13)]
        clean = []
        page_gates.gate_deck_ink(heavy, list(range(1, 13)), clean)
        self.assertEqual(clean, [])

    def test_the_codes_are_advisory_and_registered(self):
        for code in ("SCENE_INK", "DECK_INK"):
            self.assertIn(code, page_gates.GATE_CODES)
            self.assertIn(code, page_gates.ADVISORY_CODES)
            self.assertIn(code, page_gates.emitted_codes())


if __name__ == "__main__":
    unittest.main()
