"""The two renderers must know the same shapes.

A scene node names its geometry (`rightArrow`, `chevron`, `downArrow`), and two
independent renderers turn that name into something drawn: the HTML adapter maps
it to polygon points, the PPTX emitter to a PresentationML preset. Both lists are
maintained by hand, in different languages, and nothing compared them - so a
component could add a shape, look right in every HTML-based test in the suite,
and export a deck with a missing or wrong shape in it. The HTML adapter throws on
an unknown geometry; python-pptx silently falls back.

This asserts the vocabularies agree, and that every geometry a component actually
emits is in both - read off what each renderer does with a shape, and off the
geometries the registry's samples, examples and example decks draw.
"""

from __future__ import annotations

import json
import sys
import unittest

from node_probe import RUNTIME, requires_python_package, run_node

# Handled by name in both renderers rather than by a shape table.
SPECIAL = {"customPolygon", "iconPath", "quoteCallout", "rect"}

sys.path.insert(0, str(RUNTIME / "emit"))
try:
    from emit_pptx import Emitter
except ImportError:  # pragma: no cover - exercised only without python-pptx
    Emitter = None


def pptx_shapes() -> set[str]:
    """The presets the emitter draws a geometry name as; chevron is drawn by name."""
    return set(Emitter.PRESETS) | {"chevron"}


def html_draws(names) -> dict:
    """Whether the HTML adapter draws each geometry (it throws on one it does not know)."""
    return run_node(f"""
import {{ renderSlideHtml }} from './skills/professional-slides/runtime/adapters/html.mjs';
const draws = (geometry) => {{ try {{
  renderSlideHtml({{ id: 's', nodes: [{{ id: 'n', type: 'shape', role: 'shape', frame: {{ x: 10, y: 10, width: 80, height: 40 }},
    style: {{ fill: '#000000' }}, data: {{ geometry }} }}] }});
  return true; }} catch (error) {{ return /geometry/i.test(error.message) ? false : error.message; }} }};
console.log(JSON.stringify(Object.fromEntries({json.dumps(sorted(names))}.map((g) => [g, draws(g)]))));
""")


def emitted_geometries() -> set[str]:
    """Every geometry the registry's samples and examples, and the composed example decks, draw."""
    return set(run_node("""
import fs from 'node:fs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const found = new Set(), frame = { x: 60, y: 140, width: 1160, height: 520 };
const collect = (nodes) => { for (const node of nodes || []) if (node.data?.geometry) found.add(node.data.geometry); };
for (const [, owner] of REGISTRY) {
  for (const props of [owner.sample, ...Object.values(owner.examples || {}).map((e) => e?.props ?? e)].filter(Boolean)) {
    try { collect(owner.render({ id: 'g', frame, props }).nodes); } catch { /* a sample that needs a page around it */ }
  }
}
const dir = './skills/professional-slides/examples';
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.deck.json')))
  for (const slide of planDeck(toDeckPlan(JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8')), dir)).deck.slides) collect(slide.nodes);
console.log(JSON.stringify([...found]));
""")) - SPECIAL


@requires_python_package("pptx")
class GeometryParityTests(unittest.TestCase):
    def test_both_renderers_know_the_same_shapes(self):
        pptx = pptx_shapes()
        drawn = html_draws(pptx | {"noSuchShape"})
        self.assertIs(drawn.pop("noSuchShape"), False, "the HTML adapter no longer refuses an unknown geometry")
        self.assertEqual(
            {name for name, ok in drawn.items() if ok is not True}, set(),
            "the PPTX emitter lists shapes the HTML adapter cannot draw; add them to SHAPE_POINTS "
            "or drop them, because a component using one would throw in every HTML test")

    def test_every_geometry_a_component_emits_is_drawable(self):
        emitted, pptx = emitted_geometries(), pptx_shapes()
        self.assertGreater(len(emitted), 4, "the samples drew almost no shapes; the collection is broken")
        self.assertEqual(emitted - pptx, set(), "geometry emitted but absent from the PPTX emitter")
        drawn = html_draws(emitted)
        self.assertEqual({name for name, ok in drawn.items() if ok is not True}, set(),
                         "geometry emitted but absent from the HTML adapter")


if __name__ == "__main__":
    unittest.main()
