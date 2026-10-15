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
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from node_probe import ROOT, run_node

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
        self.assertEqual(out["spacebar"]["peer"], "#919192")  # rust peers outshouted the navy subject; they go grey
        self.assertEqual(out["ba"]["peer"], out["ba"]["lead"])  # navy among its own lighter blue already reads as chosen
        self.assertEqual(out["crimson"]["peer"], out["crimson"]["lead"])  # red among grey stands out by colour
        for name in ("midnight", "graphite", "evergreen", "toolkit", "spacebar"):
            self.assertGreaterEqual(out[name]["apart"], 3, name)
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
