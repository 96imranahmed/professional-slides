"""The two renderers must know the same shapes.

A scene node names its geometry (`rightArrow`, `chevron`, `downArrow`), and two
independent renderers turn that name into something drawn: the HTML adapter maps
it to polygon points, the PPTX emitter to a PresentationML preset. Both lists are
maintained by hand, in different languages, and nothing compared them - so a
component could add a shape, look right in every HTML-based test in the suite,
and export a deck with a missing or wrong shape in it. The HTML adapter throws on
an unknown geometry; python-pptx silently falls back.

This asserts the vocabularies agree, and that every geometry a component actually
emits is in both.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from node_probe import ROOT, RUNTIME

HTML = RUNTIME / "adapters" / "html.mjs"
EMIT = RUNTIME / "emit" / "emit_pptx.py"

# Handled by name in both renderers rather than by a shape table.
SPECIAL = {"customPolygon", "iconPath", "quoteCallout", "rect"}


def html_shapes() -> set[str]:
    source = HTML.read_text(encoding="utf-8")
    block = re.search(r"const SHAPE_POINTS = Object\.freeze\(\{(.*?)\n\}\);", source, re.S)
    assert block, "SHAPE_POINTS table not found in the HTML adapter"
    names = set(re.findall(r"^\s{2}([A-Za-z0-9]+):", block.group(1), re.M))
    # `chevron` is computed rather than tabulated: its inset depends on the frame.
    names.add("chevron")
    return names


def pptx_shapes() -> set[str]:
    source = EMIT.read_text(encoding="utf-8")
    block = re.search(r"PRESETS = \{(.*?)\n    \}", source, re.S)
    assert block, "PRESETS table not found in the PPTX emitter"
    return set(re.findall(r'"([A-Za-z0-9]+)": MSO_SHAPE', block.group(1)))


def emitted_geometries() -> set[str]:
    """Every geometry a runtime module asks for, by literal."""
    found: set[str] = set()
    for path in sorted(RUNTIME.rglob("*.mjs")):
        for match in re.finditer(r'geometry:\s*"([A-Za-z0-9]+)"', path.read_text(encoding="utf-8")):
            found.add(match.group(1))
        # `geometry: across ? "downArrow" : "rightArrow"` and friends.
        for match in re.finditer(r'geometry:\s*[^,\n]*\?\s*"([A-Za-z0-9]+)"\s*:\s*"([A-Za-z0-9]+)"', path.read_text(encoding="utf-8")):
            found.update(match.groups())
    return found - SPECIAL


class GeometryParityTests(unittest.TestCase):
    def test_both_renderers_know_the_same_shapes(self):
        html, pptx = html_shapes(), pptx_shapes()
        self.assertEqual(
            html - pptx, set(),
            "the HTML adapter draws shapes the PPTX emitter cannot; add them to PRESETS")
        self.assertEqual(
            pptx - html, set(),
            "the PPTX emitter lists shapes the HTML adapter cannot draw; add them to SHAPE_POINTS "
            "or drop them, because a component using one would throw in every HTML test")

    def test_every_geometry_a_component_emits_is_drawable(self):
        emitted, html, pptx = emitted_geometries(), html_shapes(), pptx_shapes()
        self.assertTrue(emitted, "no geometry literals found; the scan is broken")
        self.assertEqual(emitted - html, set(), "geometry emitted but absent from the HTML adapter")
        self.assertEqual(emitted - pptx, set(), "geometry emitted but absent from the PPTX emitter")
