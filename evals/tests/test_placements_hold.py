"""The placements and forms a page is offered are ones its exhibit can hold.

On the BA retest the plan gave commentary "on-exhibit" to a bullet chart
(na06) and a waffle (na08), which draw no callout and no number mark, and a
trellis of small multiples to a page whose measures were in millions of
passengers and in percent (na10): each was refused only when the writer wrote
the page. And the spine's provisional PAGE_SHAPE_FLAT counted a page declared
`beside` as evidence-only until its points were written, so nine placements
the lead moved did not move the count.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { PAGE_TYPES, compilePage, placementsOf } from './skills/professional-slides/runtime/page-types.mjs';
import { declaredArchitecture } from './skills/professional-slides/runtime/deck-structure.mjs';
const refusal = (fn) => { try { fn(); return null; } catch (error) { return error.message; } };
"""


class PlacementTests(unittest.TestCase):
    def test_on_exhibit_is_offered_where_the_chart_draws_a_callout_or_a_number_mark(self):
        """Read off the charts themselves (their registry `decorations`), not a list of form names."""
        result = run_node(PRELUDE + """
const out = {};
for (const [type, t] of Object.entries(PAGE_TYPES)) for (const [form, kind] of Object.entries(t.forms)) {
  const drawn = REGISTRY.get(kind)?.decorations?.draws;
  if (drawn) out[`${type}/${form}`] = { offered: placementsOf(type, form).includes('on-exhibit'), draws: drawn.some((key) => ['annotations', 'changeAnnotations', 'referenceLines', 'segmentGrowth', 'seriesGrowth'].includes(key)) };
}
console.log(JSON.stringify({ out, flow: placementsOf('mechanism', 'flow'), map: placementsOf('place', 'map'), model: placementsOf('trend', 'model') }));
""")
        for name in ("ranking/bullet", "composition/waffle", "composition/pie"):
            self.assertFalse(result["out"][name]["offered"], name)
        for name in ("ranking/bar", "trend/line", "composition/marimekko"):
            self.assertTrue(result["out"][name]["offered"], name)
        for name, case in result["out"].items():
            if case["offered"]:
                self.assertTrue(case["draws"], name)
        # A diagram, a map and a model page's chart carry their explanation in their own labels: kept as their type offers it.
        for name in ("flow", "map", "model"):
            self.assertIn("on-exhibit", result[name], name)

    def test_the_spine_refuses_on_exhibit_on_a_chart_that_draws_no_callout(self):
        result = run_node(PRELUDE + """
const page = { id: 'na06', type: 'ranking', form: 'bullet', commentary: 'on-exhibit', takeaway: false, why: 'Each city against the share the hub should hold',
  title: 'Heathrow carries most of London traffic to twenty US cities', settles: { kind: 'share', what: 'share by city' } };
console.log(JSON.stringify({ bullet: refusal(() => compilePage(page, 0, { spineOnly: true })), bar: refusal(() => compilePage({ ...page, form: 'bar' }, 0, { spineOnly: true })) }));
""")
        self.assertIn('a bullet chart draws no callout and no number mark', result["bullet"])
        self.assertIn('"so-what-bar"', result["bullet"])
        self.assertFalse(result["bar"] and "draws no callout" in result["bar"], result["bar"])

    def test_a_trellis_of_two_units_is_refused_at_the_spine_and_not_offered(self):
        result = run_node(PRELUDE + """
const insights = new Map([['traffic', { id: 'traffic', measures: { passengers: { unit: 'passengers m', values: [] }, loadFactor: { unit: '%', values: [] }, cabin: { unit: '%', values: [] } } }]]);
const page = (measures) => ({ id: 'na10', type: 'panels', form: 'small-multiples', commentary: 'so-what-bar', takeaway: false, why: 'Each route over the same years',
  title: 'North Atlantic traffic recovered while load factor held', settles: { kind: 'rate', what: 'traffic and load factor', measures } });
const mixed = refusal(() => compilePage(page(['traffic/passengers', 'traffic/loadFactor']), 0, { spineOnly: true, insights }));
const one = refusal(() => compilePage(page(['traffic/loadFactor', 'traffic/cabin']), 0, { spineOnly: true, insights }));
console.log(JSON.stringify({ mixed, one, offered: placementsOf('panels', 'small-multiples', { units: ['passengers m', '%'] }), single: placementsOf('panels', 'small-multiples', { units: ['%'] }).length }));
""")
        self.assertIn("one scale is one unit", result["mixed"])
        self.assertIn('"row"', result["mixed"])
        self.assertFalse(result["one"] and "one scale is one unit" in result["one"], result["one"])
        self.assertEqual(result["offered"], [])
        self.assertGreater(result["single"], 0)


class ProvisionalShapeTests(unittest.TestCase):
    def test_a_spine_page_is_counted_by_its_declared_placement(self):
        result = run_node(PRELUDE + """
const slide = (commentary) => ({ id: 'p', title: 'A chart', pageType: { type: 'ranking', form: 'bar', commentary }, exhibit: { type: 'chart.bar', categories: ['A', 'B'], series: [{ name: 'v', values: [1, 2] }] } });
console.log(JSON.stringify(Object.fromEntries(['beside', 'beside-left', 'below', 'captions', 'rail', 'so-what-bar', 'on-exhibit', 'none'].map((c) => [c, declaredArchitecture(slide(c))]))));
""")
        for placed in ("beside", "beside-left", "below", "captions"):
            self.assertEqual(result[placed], "evidence-with-commentary", placed)
        # A rail and a so-what bar are the page's close (RAIL_AS_CLOSE), callouts and none leave it to the exhibit.
        for close in ("rail", "so-what-bar", "on-exhibit", "none"):
            self.assertEqual(result[close], "evidence-only", close)


if __name__ == "__main__":
    unittest.main()
