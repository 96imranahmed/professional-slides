"""Component measurement at three widths (revamp item 7).

`preferredSize` is a literal; `measureContent` is the only thing that knows what
a component's content actually needs. 53 components carry a literal and 12 carry
a measurer, so every layout decision above is made against a guess.

This test does two things:

* For every component that has a `measureContent`, run it at 0.5x, 1x and 1.5x
  its preferred width. It must not throw, and its height must respond to width
  once the content is long enough to wrap - a measurer that returns a constant
  is a literal wearing a function's clothes.
* Count and name the components that have no measurer at all. That count is the
  metric item 7 drives to zero; the test fails if it grows.
"""

from __future__ import annotations

import json
import os
import unittest

from node_probe import run_node

# Components whose measurer cannot complete today. Each entry is a live defect,
# not an exemption: the list may shrink, never grow.
KNOWN_MEASURE_DEFECTS = {
    "bullet-list": "measureContent refuses every variant except body",
    "evidence-note": "definition.resolveVariant is not a function",
    "insight-tree-table": "returns no height at any width",
    # "heatmap" used to throw on an unbreakable header at 0.5x; a column now
    # widens to its longest word (tables.mjs widenForWords), so it measures.
}

# Components whose measured height is legitimately width-independent for the
# sample props. `chart-title` is a one-line heading band: at every width its
# height is the heading line box plus the rule and content gaps, by design
# (registry.mjs headingLayout). These are checked against the line box instead
# of against a change in height.
WIDTH_INDEPENDENT = {"chart-title"}

PROBE = """
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {lineBox} from './skills/professional-slides/runtime/text-layout.mjs';

const LONG = ' with an additional measured clause that forces a wrap at narrow widths';
function amplify(value, depth) {
  if (typeof value === 'string') return depth > 0 && value.length >= 4 ? value + LONG : value;
  if (Array.isArray(value)) return value.map(item => amplify(item, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = amplify(value[key], depth + 1);
    return out;
  }
  return value;
}

const measured = [], missing = [];
for (const [id, definition] of REGISTRY) {
  if (typeof definition.measureContent !== 'function') { missing.push(id); continue; }
  const base = (definition.preferredSize || {}).width || 600;
  const entry = {id, preferredWidth: base, heights: [], errors: [], stressed: []};
  for (const factor of [0.5, 1, 1.5]) {
    const frame = {x: 0, y: 0, width: Math.round(base * factor), height: 4000};
    try {
      const result = definition.measureContent({frame, props: definition.sample});
      const height = result && Number(result.height);
      entry.heights.push(Number.isFinite(height) ? height : null);
      if (!Number.isFinite(height)) entry.errors.push(`${factor}x: no height`);
    } catch (error) {
      entry.heights.push(null);
      entry.errors.push(`${factor}x: ${error.message}`);
    }
  }
  const stressProps = amplify(definition.sample, 1);
  for (const factor of [0.5, 1, 1.5]) {
    const frame = {x: 0, y: 0, width: Math.round(base * factor), height: 8000};
    try {
      const result = definition.measureContent({frame, props: stressProps});
      const height = result && Number(result.height);
      entry.stressed.push(Number.isFinite(height) ? height : null);
    } catch (error) {
      entry.stressed.push(null);
    }
  }
  measured.push(entry);
}
console.log(JSON.stringify({measured, missing, total: REGISTRY.size, headingLineBox: lineBox(TOKENS['type.heading'].value)}));
"""


class MeasureVsPreferredTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node(PROBE)

    def test_every_measurer_survives_three_widths(self):
        broken = {}
        for entry in self.result["measured"]:
            if entry["errors"]:
                broken[entry["id"]] = entry["errors"]
        unexpected = {k: v for k, v in broken.items() if k not in KNOWN_MEASURE_DEFECTS}
        self.assertEqual(unexpected, {}, json.dumps(unexpected, indent=1))
        fixed = sorted(set(KNOWN_MEASURE_DEFECTS) - set(broken))
        if fixed:
            self.fail(
                "these measurers now work - delete them from KNOWN_MEASURE_DEFECTS: "
                + ", ".join(fixed))

    def test_a_working_measurer_responds_to_its_width(self):
        """A measurer that returns one number at every width measures nothing."""
        constant = []
        floor = self.result["headingLineBox"]
        for entry in self.result["measured"]:
            if entry["id"] in KNOWN_MEASURE_DEFECTS or entry["errors"]:
                continue
            if entry["id"] in WIDTH_INDEPENDENT:
                # No throw at any width, and never shorter than one line box.
                for height in entry["heights"]:
                    self.assertIsNotNone(height, entry["id"])
                    self.assertGreaterEqual(height, floor, entry["id"])
                continue
            # Prefer the stressed content: the registry samples are short enough
            # to fit on one line at any width, which hides a constant.
            heights = [h for h in entry["stressed"] if h is not None]
            if len(heights) < 2:
                heights = [h for h in entry["heights"] if h is not None]
            if len(heights) < 2:
                constant.append({"id": entry["id"], "reason": "no two widths measured"})
            elif len(set(heights)) == 1:
                constant.append({"id": entry["id"], "heights": heights})
        self.assertEqual(constant, [], json.dumps(constant, indent=1))

    def test_the_count_of_unmeasured_components_does_not_grow(self):
        """Item 7's metric. Lower this number, never raise it."""
        missing = sorted(self.result["missing"])
        ceiling = int(os.environ.get("PS_UNMEASURED_CEILING", "55"))
        self.assertLessEqual(
            len(missing), ceiling,
            "components without measureContent grew to "
            f"{len(missing)}:\n" + "\n".join(missing))
        self.assertEqual(
            len(missing) + len(self.result["measured"]), self.result["total"])

    def test_the_unmeasured_components_are_named_for_the_record(self):
        missing = sorted(self.result["missing"])
        # Charts are the largest block: every chart type sizes itself from a
        # literal 760x420 regardless of how many categories it carries.
        charts = [name for name in missing if name.startswith("chart.")]
        self.assertGreaterEqual(len(charts), 10)
        self.assertIn("metric", missing)
        self.assertIn("panel", missing)


if __name__ == "__main__":
    unittest.main()
