"""Things an author set that the runtime dropped, or drew invisibly, without a word.

A device audit against the calibration set found three: a page photograph on
a layout that keeps no place for it, category icons on a chart that draws
none (now one of the chart decorations every chart draws or refuses, which
`test_chart_catalogue` holds), and a dark canvas under the house's dark ink
and primary, which drew a chart navy on navy. Each is refused at the compile,
naming what to write instead.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const refusal = (spec) => { try { composeAll(spec, './skills/professional-slides/examples'); return null; } catch (error) { return (error.pageErrors ?? [error.message])[0]; } };
const deck = (slide, palette) => ({ schema: 'professional-slides.deck/v3', id: 't', design: 'consulting', ...(palette ? { palette } : {}), cover: { title: 'T' }, slides: [slide] });
const chart = { type: 'chart.column', heading: 'Passengers', unit: 'million', categories: ['2023', '2024', '2025'], series: [{ name: 'Passengers', values: [79, 84, 85] }] };
const photo = { path: 'assets/harbour.jpg', alt: 'The harbour at dawn', credit: 'Illustration: synthetic example' };
"""


class DroppedUnseenTests(unittest.TestCase):
    def test_a_page_photo_with_no_place_on_its_layout_is_refused(self):
        result = run_node(PRELUDE + """
const points = ['Passengers rose to 85m in 2025, a new record for the network.', 'Growth came from the timetable recast, not new routes.'];
console.log(JSON.stringify({
  full: refusal(deck({ id: 'p1', title: 'Passengers reached a record 85m in 2025', layout: 'exhibit-full', exhibit: chart, photo })),
  beside: refusal(deck({ id: 'p2', title: 'Passengers reached a record 85m in 2025', layout: 'exhibit-left', exhibit: chart, points, photo })) }));
""")
        self.assertIn("`photo` is set as a strip beside the copy, and this exhibit-full page keeps no place for it", result["full"])
        self.assertIsNone(result["beside"], "beside the copy, the photograph has its strip")

    def test_a_dark_canvas_under_dark_ink_is_refused_and_a_light_ink_on_it_is_not(self):
        result = run_node(PRELUDE + """
const slide = { id: 'p1', title: 'Passengers reached a record 85m in 2025', layout: 'exhibit-full', exhibit: chart };
console.log(JSON.stringify({
  dark: refusal(deck(slide, { base: 'midnight', colors: { 'color.canvas': '#021B41' } })),
  marks: refusal(deck(slide, { base: 'midnight', colors: { 'color.canvas': '#021B41', 'color.ink': '#FFFFFF' } })),
  light: refusal(deck(slide, { base: 'midnight', colors: { 'color.canvas': '#021B41', 'color.ink': '#FFFFFF', 'color.componentPrimary': '#9EB7D8' } })) }));
""")
        self.assertIn("color.ink (#051C2C) reads at 1.0:1 on the canvas (#021B41), and text needs 4.5:1", result["dark"])
        self.assertIn("color.componentPrimary", result["marks"])
        self.assertIn("a chart's marks needs 2:1", result["marks"])
        self.assertIsNone(result["light"])


if __name__ == "__main__":
    unittest.main()
