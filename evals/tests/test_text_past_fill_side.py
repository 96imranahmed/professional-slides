"""Text printed on a fill stays inside it sideways, and the layer stack wraps each layer to its own band.

The published gallery's layer stack, drawn narrower with commentary beside it,
lost the ends of its lines: "...the sky stays stub", white type on the white
page past the band's right edge. Two things were wrong. The component wrapped
every layer's text to the base band's width and drew it in each narrower band
above; and no check read it, because TEXT_OFF_GROUND looked only at a fill's
foot (taking text to be laid out in the fill's width) and the contrast gates
read type inside its own frame, where it sat on its band.

These hold both: the component measures each layer at the width its band
leaves (and says which layer when the stack cannot fit), and the scene check
refuses any text whose ink runs past the side of the fill it is printed on.
"""

from __future__ import annotations

import json
import unittest

from node_probe import run_node

# The gallery page's wording, at the width the exhibit has beside its commentary.
LAYERS = [
    {"label": "Rain guarantee", "text": "£1,200 per storm in refunds, paid whenever the sky stays stubbornly dry for 48 hours after seeding"},
    {"label": "Seeding flights", "text": "£2,600 per storm for aircraft, pilots and fuel, paid in full whether the cloud cooperates or not"},
    {"label": "Flares and chemistry", "text": "£600 per storm for silver iodide flares, two per cloud, plus the occasional dud that only fizzles"},
    {"label": "Permits and ground crew", "text": "£800 per storm for airspace permits, landowner consents and the crew who watch the windsock"},
    {"label": "Forecast and radar desk", "text": "£1,800 per storm for the meteorologists and radar that decide which clouds are worth chasing"},
]

PROBE = """
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { sceneCollisions, inkBox } from './skills/professional-slides/runtime/validate-overlap.mjs';
const layers = %s;
const draw = (frame, props = { layers }) => REGISTRY.get('layers').render({ id: 'l', frame, props }).nodes.map((node) => ({ ...node, data: { ...node.data, componentInstance: 'l' } }));
const refusal = (frame, props) => { try { draw(frame, props); return null; } catch (error) { return error.message; } };
const offGround = (nodes) => sceneCollisions({ id: 's', nodes }).filter((f) => f.code === 'TEXT_OFF_GROUND');
"""


def probe(body: str):
    return run_node(PROBE % json.dumps(LAYERS) + body)


class LayerStackTests(unittest.TestCase):
    def test_each_layer_wraps_its_text_to_its_own_band(self):
        result = probe("""
const rows = (width) => { const nodes = draw({ x: 60, y: 168, width, height: 500 });
  const bands = nodes.filter((n) => n.role === 'layer-band'), texts = nodes.filter((n) => n.role === 'layer-text');
  return { found: offGround(nodes).length, rows: texts.map((text, i) => { const ink = inkBox(text), band = bands[i].frame;
    return { ink: Math.round(ink.x + ink.width), frame: Math.round(text.frame.x + text.frame.width), band: Math.round(band.x + band.width), measured: text.data.textLayout.width, width: text.frame.width }; }) }; };
console.log(JSON.stringify({ beside: rows(752), wide: rows(1160), narrow: rows(560) }));
""")
        for name, drawn in result.items():
            self.assertEqual(len(drawn["rows"]), 5, name)
            for row in drawn["rows"]:
                self.assertLessEqual(row["measured"], row["width"] + 0.01, f"{name}: a layer's text was wrapped for a wider box than it is drawn in")
                self.assertLessEqual(row["frame"], row["band"], f"{name}: a layer's text frame runs past its band")
                self.assertLessEqual(row["ink"], row["band"], f"{name}: a layer's text runs past its band")
            self.assertEqual(drawn["found"], 0, name)
        # The narrower bands at the top really are narrower: their text has less room than the base's.
        beside = result["beside"]["rows"]
        self.assertLess(beside[0]["width"], beside[-1]["width"])

    def test_a_stack_that_cannot_fit_names_the_layer(self):
        result = probe("""
const long = layers.map((layer, i) => (i === 2 ? { ...layer, text: Array(8).fill(layer.text).join(' ') } : layer));
console.log(JSON.stringify({
  tall: refusal({ x: 60, y: 168, width: 752, height: 300 }, { layers: long }),
  thin: refusal({ x: 60, y: 168, width: 300, height: 900 }, { layers: [layers[0], { label: 'Base', text: 'Counterintuitively-unbreakable-meteorological-word' }] }) }));
""")
        self.assertRegex(result["tall"], r'needs \d+px and has 300px, \d+px too many: "Flares and chemistry" runs to \d+ lines in the \d+px')
        self.assertRegex(result["thin"], r'The layer "Base" leaves \d+px for its text beside a \d+px label')
        self.assertRegex(result["thin"], r"\(\d+px in \d+px\)", "the refusal does not say by how much the text overruns")


class TextPastFillSideTests(unittest.TestCase):
    def test_ink_past_the_side_of_its_fill_is_refused(self):
        """The defect as it was drawn: lines wrapped for 480px set in a 400px frame on a 520px band."""
        result = probe("""
const band = (width) => ({ id: 'band', type: 'rect', role: 'layer-band', frame: { x: 100, y: 100, width, height: 80 }, style: { fill: { value: '#051C2C' } }, data: { componentInstance: 'l' } });
const text = (lines, align = 'left', instance = 'l') => ({ id: 'text', type: 'text', role: 'layer-text', text: lines.join('\\n'), frame: { x: 200, y: 116, width: 400, height: 48 },
  style: { align, valign: 'top', fontFamily: { value: 'Arial' }, fontSize: { value: 12 } }, data: { componentInstance: instance, textLayout: { lines, lineHeight: 24, height: 48, width: 480 } } });
const wide = ['£1,200 per storm in refunds, paid whenever the sky stays stubbornly dry', 'for 48 hours after seeding'];
const fits = ['£1,200 per storm in refunds, paid whenever', 'the sky stays stubbornly dry for 48 hours'];
const found = (nodes) => offGround(nodes).map((f) => [f.text, f.ground, f.aside > 0]);
console.log(JSON.stringify({
  past: found([band(520), text(wide)]), within: found([band(520), text(fits)]),
  // Another component's fill is not this text's ground: a label set beside a neighbour's panel is not printed on it.
  other: found([band(520), text(wide, 'left', 'm')]),
  // The real component, drawn as it used to be: every layer's text swapped for the base layer's wider wrap.
  old: (() => { const nodes = draw({ x: 60, y: 168, width: 752, height: 500 });
    const base = nodes.filter((n) => n.role === 'layer-text').at(-1).frame.width;
    return offGround(nodes.map((n) => { if (n.role !== 'layer-text') return n;
      const words = n.text.replace(/\\n/g, ' ').split(' '), lines = [words.slice(0, -4).join(' '), words.slice(-4).join(' ')];
      return { ...n, text: lines.join('\\n'), data: { ...n.data, textLayout: { ...n.data.textLayout, lines, width: base } } }; })).length; })() }));
""")
        self.assertEqual(result["past"], [["text", "band", True]])
        self.assertEqual([result["within"], result["other"]], [[], []])
        self.assertGreater(result["old"], 0, "the layer stack's old wrap, one long line in every band, passed the check")


if __name__ == "__main__":
    unittest.main()
