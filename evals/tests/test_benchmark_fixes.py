"""What the Spacebar benchmark (October 2026) found the skill's deck doing worse than plain Claude's, held where it was fixed.

Read beside the deck plain Claude made from the same request, four of the skill's pages were weaker: its highlighted bar sat
navy among louder rust peers; its heat table, treemap and capsules filled whole cells and pillars near-black; a treemap of
six near-equal weights compared nothing; and a strip of app screenshots, like the cover's thumbnails of them, could not be
read. The storyline also stopped at its findings, with no limits and no close.
"""
import base64
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from node_probe import NODE, ROOT, RUNTIME, run_node

sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402

SKILL = ROOT / "skills" / "professional-slides"
PRELUDE = """
import { resolvePalette, PALETTES } from './skills/professional-slides/runtime/palettes.mjs';
import { TOKENS, THEME_SLOT_TOKENS, resolveStyle } from './skills/professional-slides/runtime/core.mjs';
import { contrastRatio } from './skills/professional-slides/runtime/color.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const SPACEBAR = { base: 'midnight', colors: { 'color.ink': '#051C2C', 'color.componentPrimary': '#111A2E', 'color.accent': '#111A2E', 'color.chartSeries1': '#A8543A', 'color.chartSeries2': '#919192', 'color.chartSeries3': '#B8BAC0' } };
const BA = { base: 'midnight', colors: { 'color.ink': '#021B41', 'color.componentPrimary': '#021B41', 'color.accent': '#3468AD', 'color.chartSeries1': '#021B41', 'color.chartSeries2': '#3468AD', 'color.chartSeries3': '#9EB7D8', 'color.chartSeries4': '#234776', 'color.chartSeries5': '#989CAE', 'color.chartSeries6': '#BECFE5' } };
const tokensOf = (palette) => resolvePalette(palette, TOKENS, THEME_SLOT_TOKENS).tokens;
const draw = (kind, props, palette = 'midnight', frame = { x: 60, y: 160, width: 760, height: 420 }) => { const tokens = tokensOf(palette);
  return { tokens, nodes: withDesignTokens(tokens, () => REGISTRY.get(kind).render({ id: 'c', frame, props }).nodes) }; };
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""


class StorylineTests(unittest.TestCase):
    def test_the_storyline_step_ends_on_the_limits_and_the_implication(self):
        # The process listed the setup and the findings and stopped; the re-authored deck ended on "next tests".
        skill = (SKILL / "SKILL.md").read_text()
        self.assertIn("then what follows: the limits of the evidence and the implication, ending the deck on it", skill)
        self.assertIn("Limits the source states itself take a page", (SKILL / "references" / "storylining.md").read_text())


class OrnamentTests(unittest.TestCase):
    def test_a_label_panel_carries_its_icon_or_nothing_and_subtitles_are_left_out_by_default(self):
        # A short accent bar over every label made a page of labelled rows a stack of ornaments (user, 2026-10-15).
        result = run_node(PRELUDE + """
import { sideStatementNodes } from './skills/professional-slides/runtime/figures.mjs';
const frame = { x: 60, y: 160, width: 228, height: 150 };
const roles = (props) => sideStatementNodes({ id: 's', frame, props: { tone: 'primary', ...props } }).map((n) => n.role);
console.log(JSON.stringify({ plain: roles({ text: 'One narrow workflow' }), icon: roles({ text: 'One narrow workflow', icon: 'flag' }) }));
""")
        self.assertNotIn("side-panel-bar", result["plain"] + result["icon"])
        self.assertEqual([r for r in result["plain"] if r != "side-panel"], ["side-panel-text"])
        self.assertIn("side-panel-icon-glyph", result["icon"])
        guide = (SKILL / "references" / "storylining.md").read_text()
        self.assertIn("A page takes a `subtitle` only where the deck the user gave as the style to follow sets a line under its titles", guide)
        self.assertNotIn("The period, population and unit go in the `subtitle`", guide)


class CommentaryTests(unittest.TestCase):
    def test_points_over_a_chart_are_placed_by_the_page_and_the_point_goes_on_the_chart(self):
        # Strong decks set a column beside under one chart or table page in five and annotate four chart pages in five; the
        # skill had set one on three of four, by default.
        result = run_node(PRELUDE + """
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const page = (more) => ({ id: 'p1', type: 'ranking', form: 'bar', title: 'Sol scored 90 of 100, 13 points ahead of Opus', takeaway: false,
  exhibit: { heading: 'Audit score', unit: 'points', categories: ['Sol', 'Opus'], series: [{ name: 'Score', values: [90, 77] }] }, ...more });
const doc = (more) => ({ deck: { schema: 'professional-slides.deck/v3', id: 't', cover: { title: 'T' } }, pages: [page(more)] });
const failed = (more) => compileDeck(doc(more), { partial: true }).failed.map((f) => f.code ?? 'COMPILE');
console.log(JSON.stringify({ unchosen: failed({ points: ['Sol led on research'] }), asked: failed({ points: ['Sol led on research'], commentary: 'beside' }),
  onChart: failed({ commentary: 'on-exhibit', exhibit: { heading: 'Audit score', unit: 'points', categories: ['Sol', 'Opus'], series: [{ name: 'Score', values: [90, 77] }], annotations: [{ category: 'Sol', text: 'Led on research, memo and consistency' }] } }) }));
""")
        self.assertEqual(result, {"unchosen": ["COMMENTARY_UNCHOSEN"], "asked": [], "onChart": []})


class RunSnagTests(unittest.TestCase):
    """What the 03c272f run's author met: a callout through a bid line, six variants for one example, a date printed
    twice in every footer, and an empty-band repair telling it to do what the page already did."""

    def test_a_reference_line_across_the_rows_gives_way_to_a_callout(self):
        result = run_node(PRELUDE + """
import { sceneDesignFindings } from './skills/professional-slides/runtime/validate-overlap.mjs';
const props = { categories: ['Discounted cash flow', 'Trading multiples', 'Precedent awards', 'Bid ladder', 'Asset base'], low: [410, 380, 350, 420, 300], high: [520, 470, 500, 480, 360],
  referenceLines: [{ value: 440, label: 'Our bid £440m' }], annotations: [{ category: 'Asset base', text: 'The walk-away floor: fleet and depots alone' }] };
const { nodes } = draw('chart.range', props);
const resolved = nodes.map((n) => ({ ...n, style: resolveStyle(n.style || {}) }));
console.log(JSON.stringify({ findings: sceneDesignFindings({ slides: [{ id: 's', nodes: resolved }] }).filter((f) => f.severity === 'blocker').map((f) => f.code),
  runs: nodes.filter((n) => n.role === 'chart-reference-line').length }));
""")
        self.assertEqual(result["findings"], [])
        self.assertGreaterEqual(result["runs"], 1)

    def test_one_example_a_form_and_a_footer_dated_once(self):
        printed = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), "--example", "lookup/table"], capture_output=True, text=True)
        self.assertEqual(json.loads(printed.stdout)["id"], "f-lookup-table")  # one page, not six
        self.assertIn("--example <id>", printed.stderr)
        result = run_node(PRELUDE + """
import { citationForms } from './skills/professional-slides/runtime/page-types.mjs';
const reg = { a: { name: 'Spacebar benchmark (Oct 2026)', date: '2026-10-14' }, b: { name: 'IAG results (Oct 2025)', date: '2026-10-14' } };
console.log(JSON.stringify({ a: citationForms(['a'], reg)[0], b: citationForms(['b'], reg)[0] }));
""")
        self.assertEqual(result["a"], "Source: Spacebar benchmark (Oct 2026)")
        self.assertEqual(result["b"], "Source: IAG results (Oct 2025), 14 Oct 2026")

    def test_an_empty_band_repair_names_only_what_the_page_has_not_done(self):
        def page(beside):
            nodes = [{"type": "text", "id": "t", "role": "action-title", "frame": {"x": 60, "y": 40, "width": 1160, "height": 40}, "text": "A title", "style": {"fontSize": 24}},
                     {"type": "rect", "id": "e", "role": "chart-mark", "frame": {"x": 60, "y": 140, "width": 700, "height": 280}, "style": {"fill": "#2251FF"}},
                     {"type": "text", "id": "p", "role": "list-item", "frame": {"x": 900 if beside else 60, "y": 150 if beside else 430, "width": 300, "height": 60}, "text": "A point", "style": {"fontSize": 12}}]
            found = []
            page_gates.gate_scene_void(2, {"id": "p", "nodes": nodes}, found)
            return [f["repair"] for f in found]
        repairs = page(True)
        self.assertTrue(repairs, "the band under a short exhibit is reported")
        self.assertNotIn("set the commentary beside", repairs[0])


class PeerColourTests(unittest.TestCase):
    def test_a_highlighted_bar_stands_out_from_its_peers_on_every_palette(self):
        result = run_node(PRELUDE + """
const out = {};
for (const [name, palette] of [...Object.keys(PALETTES).map((id) => [id, id]), ['spacebar', SPACEBAR], ['ba', BA]]) {
  const t = tokensOf(palette), v = (key) => t[key].value;
  out[name] = { subject: v('color.chartSubject'), peer: v('color.chartPeer'), lead: v('color.chartSeries1'), apart: contrastRatio(v('color.chartSubject'), v('color.chartPeer')) };
}
const { tokens, nodes } = draw('chart.bar', { categories: ['A', 'B', 'C'], series: [{ name: 'm', values: [9, 7, 5] }], highlights: [{ category: 'B' }] }, SPACEBAR);
const plain = draw('chart.bar', { categories: ['A', 'B', 'C'], series: [{ name: 'm', values: [9, 7, 5] }] }, SPACEBAR);
const fills = (list) => list.filter((n) => n.role === 'chart-mark').map((n) => n.style.fill.tokenId);
console.log(JSON.stringify({ out, lit: fills(nodes), plain: fills(plain.nodes) }));
""")
        out = result["out"]
        # The subject takes the accent, as strong decks draw it, and its peers a neutral tone (palettes.mjs subjectOf, peerOf).
        self.assertEqual((out["spacebar"]["subject"], out["spacebar"]["peer"]), ("#A8543A", "#919192"))  # rust among grey
        self.assertEqual(out["midnight"]["subject"], "#2251FF")
        self.assertEqual(out["ba"]["subject"], "#3468AD")
        self.assertEqual(out["crimson"]["peer"], out["crimson"]["lead"])  # red among its own grey
        for name, palette in out.items():
            self.assertGreaterEqual(palette["apart"], 1.5, name)  # apart in lightness too, for a reader who cannot see hue
        self.assertEqual(result["lit"], ["color.chartPeer", "color.chartSubject", "color.chartPeer"])
        self.assertEqual(result["plain"], ["color.chartSeries1"] * 3)  # no subject, no peers: the lead colour as before


class DarkFillTests(unittest.TestCase):
    def test_heat_scales_capsules_and_tiles_take_mid_colours(self):
        result = run_node(PRELUDE + """
import { capsulesNodes } from './skills/professional-slides/runtime/figures.mjs';
const t = tokensOf(SPACEBAR), crimson = tokensOf('crimson');
const capsules = withDesignTokens(t, () => capsulesNodes({ id: 'k', frame: { x: 60, y: 160, width: 1160, height: 460 }, props: { items: [{ title: 'Spatial tasks', text: 'Notes on artifacts' }, { title: 'People', text: 'Concurrent edits' }] } }));
const body = capsules.find((n) => n.role === 'capsule-body'), title = capsules.find((n) => n.role === 'capsule-title');
const value = (style) => t[style?.tokenId]?.value ?? style?.value ?? style;
const tiles = draw('chart.treemap', { items: [10, 9, 8, 6, 5, 4, 3, 2].map((v, i) => ({ label: 'T' + i, value: v * 10 })) }, BA);
const dark = tiles.nodes.filter((n) => n.role === 'chart-mark').filter((n) => contrastRatio(tiles.tokens[n.style.fill.tokenId].value, '#FFFFFF') >= 10).length;
console.log(JSON.stringify({ heatTop: t['color.heat.theme-sequential.10'].value, lead: t['color.chartSeries1'].value, crimsonTop: crimson['color.heat.theme-sequential.10'].value,
  crimsonPrimary: crimson['color.componentPrimary'].value, capsule: body.style.fill.tokenId, capsuleType: contrastRatio(value(resolveStyle(body.style).fill), value(resolveStyle(title.style).color)), dark }));
""")
        self.assertEqual(result["heatTop"], result["lead"])  # the darkest cell is the mid colour, not the near-black primary
        self.assertEqual(result["crimsonTop"], result["crimsonPrimary"])  # a grey lead runs to the house's own colour
        self.assertEqual(result["capsule"], "color.chartSeries1")
        self.assertGreaterEqual(result["capsuleType"], 4.5)
        self.assertEqual(result["dark"], 0)  # no tile near-black unless it is the subject


class FormFitTests(unittest.TestCase):
    def test_a_treemap_of_near_equal_parts_is_refused_and_rare_forms_are_listed_last(self):
        result = run_node(PRELUDE + """
import { describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
const rubric = refusal(() => draw('chart.treemap', { items: [['Research', 15], ['Spreadsheet', 25], ['App', 15], ['Memo', 15], ['Consistency', 15], ['Reliability', 15]].map(([label, value]) => ({ label, value })) }));
const regions = refusal(() => draw('chart.treemap', { items: [['North Atlantic', 30], ['Europe', 26], ['Latin America', 20], ['Africa', 12], ['Domestic', 8], ['Asia', 4]].map(([label, value]) => ({ label, value })) }));
const types = describeTypes();
const composition = types.slice(types.indexOf('## composition')).split('## ')[1];
console.log(JSON.stringify({ rubric, regions, composition }));
""")
        self.assertIn("NO_COMPARISON", result["rubric"])
        self.assertIsNone(result["regions"])
        self.assertIn("- form: stacked-bar | stacked-column | donut | pie", result["composition"])
        self.assertIn("- use sparingly: ", result["composition"])
        self.assertIn("treemap - six or more parts whose sizes differ several-fold", result["composition"])

    def test_a_screenshot_too_small_to_read_is_refused_and_a_photograph_is_not(self):
        def uri(image):
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()

        screen = Image.new("RGB", (2400, 1500), "#FFFFFF")
        draw = ImageDraw.Draw(screen)
        draw.rectangle([0, 0, 2400, 120], fill="#1E2A44")
        for row in range(10):
            draw.rectangle([80, 200 + row * 120, 1500, 260 + row * 120], fill="#EEF1F6")
        photo = Image.effect_noise((2400, 1500), 64).convert("RGB")
        node = lambda image, width, height: {"type": "image", "id": "p", "role": "image", "frame": {"x": 60, "y": 140, "width": width, "height": height}, "style": {}, "data": {"dataUri": uri(image)}}
        found = []
        for picture in (node(screen, 379, 237), node(photo, 379, 237), node(screen, 960, 600)):
            page_gates.gate_picture_unreadable(2, {"id": "p", "nodes": [picture]}, found)
        self.assertEqual([f["code"] for f in found], ["PICTURE_UNREADABLE"])  # the capture at 16%; not the photo, not at 40%
        self.assertEqual(found[0]["measured"]["drawn"][0], 379)

    def test_a_cover_shows_logos_but_never_photographs_of_its_players(self):
        tmp = Path(tempfile.mkdtemp(prefix="cover-marks-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        (tmp / "assets").mkdir()
        for name in ("a", "b"):
            Image.new("RGB", (1600, 1000), "#E0E4EA").save(tmp / "assets" / f"{name}.png")
            Image.new("RGB", (400, 120), "#C8102E").save(tmp / "assets" / f"{name}-logo.png")
        result = run_node(f"""
import {{ composeDeck }} from './skills/professional-slides/runtime/compose-deck.mjs';
const deck = (players) => composeDeck({{ schema: 'professional-slides.deck/v3', id: 't', cover: {{ title: 'A title' }}, players, slides: [] }}, {json.dumps(str(tmp))});
const cover = (plan) => (plan.slides ?? plan.deckPlan?.slides ?? []).find((s) => s.id === 'cover' || s.kind === 'cover');
const photos = deck([{{ name: 'A', mark: 'image', image: {{ path: 'assets/a.png', alt: 'A app' }} }}, {{ name: 'B', mark: 'image', image: {{ path: 'assets/b.png', alt: 'B app' }} }}]);
const logos = deck([{{ name: 'A', logo: {{ path: 'assets/a-logo.png' }} }}, {{ name: 'B', logo: {{ path: 'assets/b-logo.png' }} }}]);
console.log(JSON.stringify({{ photos: (cover(photos)?.marks ?? []).length, logos: (cover(logos)?.marks ?? []).length }}));
""")
        self.assertEqual(result, {"photos": 0, "logos": 2})


if __name__ == "__main__":
    unittest.main()
