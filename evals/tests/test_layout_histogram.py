"""Layout diversity across a real deck (revamp item 11, LAYOUT_MONOTONY).

A deck where a scorecard, a full-bleed exhibit and a two-column comparison are
all the same frame reads as one page repeated. The gate computes a signature per
content slide - the sorted multiset of top-level component ids plus the row and
column shape - and refuses to let any one signature account for more than 40% of
the content slides.

This test pins the histogram of the audited deck and checks the signature
function itself: it must separate pages that look different and collapse pages
that look the same.
"""

from __future__ import annotations

import collections
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
SCENE_GZ = ROOT / "evals" / "fixtures" / "scene-nyc.json.gz"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


def histogram(scene):
    counts = collections.Counter()
    for index, slide in enumerate(scene["slides"]):
        if page_gates.is_cover(slide, index):
            continue
        signature = page_gates.layout_signature(slide)
        if signature is not None:
            counts[signature] += 1
    return counts


class LayoutHistogramTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scene = page_gates.load_scene(SCENE_GZ)
        cls.counts = histogram(cls.scene)

    def test_the_audited_deck_repeats_one_layout_past_the_limit(self):
        total = sum(self.counts.values())
        self.assertEqual(total, 20)
        signature, count = self.counts.most_common(1)[0]
        self.assertGreater(count / total, page_gates.THRESHOLDS["monotony_max"])
        # The repeated page is a single hugged band over a footer paragraph.
        self.assertIn("paragraph", signature)

    def test_the_deck_uses_far_fewer_architectures_than_it_has_pages(self):
        self.assertLessEqual(len(self.counts), 8)
        self.assertGreaterEqual(len(self.counts), 2)

    def test_a_signature_separates_pages_that_look_different(self):
        def slide(instances):
            return {
                "id": "s09",
                "componentInstances": [
                    {"id": "chrome", "component": "slide-chrome",
                     "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}}
                ] + [
                    {"id": f"s09-{i}", "component": component, "frame": frame}
                    for i, (component, frame) in enumerate(instances)
                ],
            }

        stacked = slide([
            ("table", {"x": 60, "y": 162, "width": 1160, "height": 300}),
            ("paragraph", {"x": 60, "y": 500, "width": 1160, "height": 50}),
        ])
        side_by_side = slide([
            ("table", {"x": 60, "y": 162, "width": 560, "height": 300}),
            ("paragraph", {"x": 660, "y": 162, "width": 560, "height": 300}),
        ])
        hero = slide([("chart.column", {"x": 60, "y": 162, "width": 1160, "height": 460})])

        signatures = {page_gates.layout_signature(s) for s in (stacked, side_by_side, hero)}
        self.assertEqual(len(signatures), 3)
        # Two pages with the same components in the same shape collapse.
        self.assertEqual(
            page_gates.layout_signature(stacked),
            page_gates.layout_signature(slide([
                ("table", {"x": 60, "y": 170, "width": 1160, "height": 290}),
                ("paragraph", {"x": 60, "y": 505, "width": 1160, "height": 50}),
            ])))

    def test_chrome_and_nested_children_never_enter_the_signature(self):
        slide = self.scene["slides"][5]
        top = page_gates.top_level_instances(slide)
        ids = {instance["id"] for instance in top}
        self.assertNotIn("chrome", ids)
        self.assertTrue(ids)
        for identifier in ids:
            suffix = identifier[len(slide["id"]) + 1:]
            self.assertNotIn("-", suffix, f"{identifier} is a nested child")
        # Every top-level instance is really on the page.
        self.assertLess(len(top), len(slide["componentInstances"]))

    def test_a_varied_deck_passes_the_monotony_gate(self):
        slides = []
        shapes = [
            [("table", 1160)], [("chart.column", 560), ("paragraph", 560)],
            [("chart.bar", 1160)], [("image-frame", 760), ("paragraph", 380)],
            [("comparison-table", 1160)],
        ]
        for index, shape in enumerate(shapes):
            x = 60
            instances = [{"id": "chrome", "component": "slide-chrome",
                          "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}}]
            for position, (component, width) in enumerate(shape):
                instances.append({
                    "id": f"s{index:02d}-{position}", "component": component,
                    "frame": {"x": x, "y": 162, "width": width, "height": 460}})
                x += width + 40
            slides.append({"id": f"s{index:02d}", "componentInstances": instances, "nodes": []})
        findings = []
        page_gates.gate_layout_monotony(slides, list(range(len(slides))), findings)
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
