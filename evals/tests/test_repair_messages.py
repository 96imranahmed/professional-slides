"""Refusals that say what to write.

Section writers learned what a refusal meant by reading the runtime: they
searched its source for the code, the helper it calls and the form it reads,
and wrote the fix by trial. A repair now names the field to change by the path
an edit names it with (or the deck key), the value it measured, the limit it
holds the page to, and a concrete edit. One test a code, each holding its
message to the field and the numbers. (The peer-set refusals are held in
test_deck_conventions.py, NUMBER_FORMATS_DIFFER in test_deck_consistency.py,
SPINE_LOCKED in test_storyline_closure.py.)
"""
from __future__ import annotations

import json
import math
import re
import sys
import unittest

from node_probe import RUNTIME, SKILL, run_node

sys.path.insert(0, str(RUNTIME / "gates"))
import page_gates  # noqa: E402
import render_gates  # noqa: E402
import scene_gates  # noqa: E402

COMPOSE = """
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const BASE = './skills/professional-slides/examples';
const deck = (slides, more = {}) => ({ schema: 'professional-slides.deck/v3', id: 't', design: 'consulting', ...more, slides });
const scene = (spec) => composeAll(structuredClone(spec), BASE).deck;
const chart = (heading, more = {}) => ({ type: 'chart.column', heading, unit: 'million', categories: ['2022', '2023', '2024', '2025'], series: [{ name: 'Journeys', values: [710, 790, 840, 850] }], ...more });
"""


def scene(spec_js: str) -> dict:
    return run_node(COMPOSE + f"console.log(JSON.stringify(scene({spec_js})));")


class GroundContrastTests(unittest.TestCase):
    def test_a_dark_canvas_under_light_page_colours_names_the_palette_key_the_ratio_and_tone(self):
        dark = scene("deck([{ id: 'p1', title: 'Journeys reached a record 850 million in 2025', layout: 'exhibit-full', exhibit: chart('Journeys'), source: 'Source: illustrative data' }], "
                     "{ palette: { base: 'midnight', colors: { 'color.canvas': '#0B2341', 'color.ink': '#FFFFFF', 'color.componentPrimary': '#9EB7D8' } } })")
        [found] = page_gates.run_gates(dark, gates={"GROUND_CONTRAST"})["findings"]
        measured, repair = found["measured"], found["repair"]
        self.assertEqual(measured["field"], 'deck.palette.colors["color.canvas"]')
        self.assertIn("reads at {}:1 on its ground".format(measured["ratio"]), repair)
        self.assertIn("under the {}:1".format(found["threshold"]), repair)  # 2.5 for type, 2.0 for an exhibit's marks
        self.assertIn('The page\'s ground is `deck.palette.colors["color.canvas"]`, #0B2341', repair)
        self.assertIn('set `deck.tone` to "dark"', repair)

    def test_type_lost_on_a_panel_names_its_token_and_the_nearest_colour_that_reads(self):
        slide = {"tokens": {"color.canvas": {"value": "#FFFFFF"}}, "nodes": [
            {"id": "t1", "type": "text", "role": "paragraph", "text": "Journeys rose to 850 million", "frame": {"x": 100, "y": 200, "width": 400, "height": 20},
             "style": {"color": {"tokenId": "color.textSecondary", "value": "#CCCCCC"}, "fontSize": {"value": 12}}}]}
        findings = []
        scene_gates.gate_ground_contrast(1, slide, findings)
        [found] = findings
        self.assertEqual(found["measured"]["field"], 'deck.palette.colors["color.textSecondary"]')
        suggested = re.search(r"set `deck\.palette\.colors\[\"color\.textSecondary\"\]` to (#[0-9A-F]{6}) \(([\d.]+):1 on #FFFFFF\)", found["repair"])
        self.assertIsNotNone(suggested, found["repair"])
        self.assertGreaterEqual(float(suggested.group(2)), 2.5)
        self.assertIn("reads at 1.61:1 on its ground (#CCCCCC on #FFFFFF), under the 2.5:1", found["repair"])


class NiceTicksTests(unittest.TestCase):
    def test_an_authored_domain_off_the_ladder_names_its_bounds_and_the_domain_that_divides(self):
        drawn = scene("deck([{ id: 'p1', title: 'Journeys reached a record 850 million in 2025', layout: 'two-up', "
                      "exhibits: [chart('Left panel', { yMin: 0, yMax: 7000, gridlines: true, dataLabels: false }), chart('Right panel')], source: 'Source: illustrative data' }])")
        [found] = page_gates.run_gates(drawn, gates={"NICE_TICKS"})["findings"]
        self.assertEqual(found["measured"]["field"], "exhibits[0].yMin")
        self.assertEqual(found["measured"]["ticks"], [0, 1750, 3500, 5250, 7000])
        self.assertIn('`exhibits[0]` ("Left panel") draws its y axis 0 to 7000 in 4 steps of 1750: step is off the ladder', found["repair"])
        self.assertIn("every step is 1, 2, 2.5 or 5 times a power of ten", found["repair"])
        self.assertIn("set `exhibits[0].yMin` to 0 and `exhibits[0].yMax` to 7500 - 3 whole steps of 2500", found["repair"])


class NoteHeavyTests(unittest.TestCase):
    NOTE = ("Figures exclude charter traffic and two stations sold in 2023, restated on the current network; the 2025 figure is the "
            "operator's estimate before audit and may move by a point either way.")

    def note_heavy(self, points, source="Source: operator reports"):
        drawn = scene("deck([{ id: 'p1', title: 'Journeys reached a record 850 million in 2025', layout: 'exhibit-left', exhibit: chart('Journeys'), "
                      f"points: {json.dumps(points)}, note: {json.dumps(self.NOTE)}, source: {json.dumps(source)} }}])")
        slide = drawn["slides"][0]
        slide["readingTask"] = "chart-with-commentary"
        findings = []
        render_gates.gate_thin_page(1, slide, findings)
        return next(f for f in findings if f["code"] == "NOTE_HEAVY")

    def test_the_note_is_told_its_words_and_the_most_it_can_hold(self):
        found = self.note_heavy(["Journeys grew in every year of the four, the steepest rise after the timetable change of 2023 added off-peak trains.",
                                 "The growth came from leisure trips, which rose twice as fast as commuting over the same period."])
        m, repair = found["measured"], found["repair"]
        self.assertEqual(m["most"], math.floor(m["body"] * 0.3 / 0.7 + 1e-9))
        self.assertIn("The footer carries {} words to the body's {}".format(m["footer"], m["body"]), repair)
        self.assertIn("the page's note (`note`, `footnotes`) is {} words".format(m["note"]), repair)
        self.assertIn("the footer holds {} at most, so {} words come out".format(m["most"], m["footer"] - m["most"]), repair)
        self.assertGreater(m["noteMost"], 0)
        self.assertEqual(m["noteMost"], m["most"] - (m["footer"] - m["note"]))
        self.assertIn("Cut `note` to {} words or fewer".format(m["noteMost"]), repair)

    def test_a_note_with_no_room_is_told_so_with_what_takes_the_footer(self):
        found = self.note_heavy(["Journeys grew."], source="Source: operator annual reports 2022 to 2025, the national rail statistics series and the regulator's station usage estimates")
        m = found["measured"]
        self.assertEqual(m["noteMost"], 0)
        self.assertIn("The note can hold 0 words: the source line and the furniture take {} of the {} the footer holds".format(m["footer"] - m["note"], m["most"]), found["repair"])


class TextPlanTests(unittest.TestCase):
    PROBE = """
import { checkTextPlan } from './skills/professional-slides/runtime/text-contract.mjs';
const reasons = (content) => checkTextPlan(content).findings.map((f) => [f.code, f.reason, f.measured ?? null]);
"""

    def test_an_incomplete_plan_names_each_block_at_fault(self):
        result = run_node(self.PROBE + """
console.log(JSON.stringify({
  authored: reasons({ textContract: 'complete', pages: [{ id: 'p1', n: 1, textPlan: [{ id: 'a', role: 'body', text: 'One block.' }, { id: 'a', role: 'heading', text: ' ' }, { role: 'body', text: 'Another.' }] }] }),
  derived: reasons({ textContract: 'complete', derivedFrom: 'pages', pages: [{ id: 'p2', n: 2, textPlan: [] }] }) }));
""")
        [(code, reason, _)] = result["authored"]
        self.assertEqual(code, "TEXT_PLAN_INCOMPLETE")
        self.assertIn("p1: `pages[0].textPlan` in the content plan has 3 blocks, and 4 faults", reason)
        self.assertIn('block 2 ("a") has role "heading", not one of the 6', reason)
        self.assertIn('block 2 ("a") has no `text`', reason)
        self.assertIn("block 3 has no `id`", reason)
        self.assertIn('id "a" is written 2 times (blocks 1, 2)', reason)
        self.assertIn("`role` one of title, body, exhibit, qualification, source, furniture", reason)
        [(_, derived, _)] = result["derived"]
        self.assertIn("p2: the text plan read off the composed page lists no block", derived)
        self.assertIn("The page composed no text it can be read by", derived)

    def test_a_page_under_its_floor_is_told_the_words_to_add(self):
        result = run_node(self.PROBE + """
const page = { id: 'p1', n: 1, textReference: { task: 'chart-led' }, textPlan: [{ id: 't', role: 'title', text: 'Journeys reached a record in 2025' }, { id: 'b', role: 'body', text: 'Journeys grew in every year.' }] };
console.log(JSON.stringify(reasons({ textContract: 'complete', pages: [page] })));
""")
        [(code, reason, measured)] = result
        self.assertEqual(code, "TEXT_COVERAGE_LOW")
        self.assertEqual(measured["body"], 5)
        self.assertEqual(measured["short"], math.ceil(measured["floor"] - 5))
        self.assertIn("Planned body has 5 words; pages doing this job carry at least {}".format(measured["floor"]), reason)
        self.assertIn("(chart-led): add {} words or more to the body".format(measured["short"]), reason)

    def test_the_compile_says_which_fields_hold_the_body_and_how_much_each_takes(self):
        # The fill search measures the lengths that fill a page where it runs; without it, the refusal still says where.
        result = run_node(f"""
import fs from 'node:fs';
import {{ authorDeck }} from './skills/professional-slides/runtime/author-deck.mjs';
const doc = JSON.parse(fs.readFileSync({json.dumps(str(SKILL / 'examples' / 'page-types.pages.json'))}, 'utf8'));
const map = doc.pages.find((p) => p.id === 'p18');
map.points = [{{ lead: 'Two cities', text: 'Most visitors start in two cities.' }}, {{ lead: 'Timed connections', text: 'Connections cut the wait.' }}];
map.highlight = ['two cities'];
const compiled = await authorDeck(doc, {{ baseDir: {json.dumps(str(SKILL / 'examples'))}, fill: false, fit: false }});
console.log(JSON.stringify(compiled.blocking.filter((f) => f.id === 'p18' && f.code === 'TEXT_COVERAGE_LOW').map((f) => [f.reason, f.measured])));
""")
        [(reason, measured)] = result
        self.assertIn("add {} words or more to the body".format(measured["short"]), reason)
        self.assertIn("Its body is written in `points` 2 of 8, 6 words", reason)
        self.assertIn("Add the {} words there - about {} more to each of the 2 points".format(measured["short"], math.ceil(measured["short"] / 2)), reason)
        self.assertIn('{ "page": "p18", "field": "points", "append": true, "value": { "lead": "...", "text": "..." } }', reason)


class PlayersUnmarkedTests(unittest.TestCase):
    def test_the_refusal_names_the_deck_key_the_pages_read_and_a_page_that_introduces_them(self):
        result = run_node("""
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const players = [{ name: 'Northwind Airlines', short: 'Northwind' }, 'Harbour Air', 'Cobalt Jet'];
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const base = { takeaway: false, why: 'The page compares the players on the same terms', settles: { kind: 'comparison', what: 'Seats flown by each player, 2019 to 2026' }, adds: 'The callout names the turn the line alone cannot' };
const chart = (id) => ({ id, ...base, title: 'Seats flown recovered by 2023 at all three players', type: 'trend', form: 'line', commentary: 'on-exhibit',
  exhibit: { categories: years, series: [{ name: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8] }, { name: 'y', values: [2, 3, 4, 5, 6, 7, 8, 9] }], annotations: [{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }] } });
const roster = { id: 'c1', ...base, title: 'Two of the three players fly most of the seats in the market', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit',
  exhibit: { columns: [{ label: '', type: 'logo' }, 'Player', 'Seats'], rows: [[{ type: 'logo', player: 'Northwind Airlines' }, 'Northwind Airlines', '12m'], [{ type: 'logo', player: 'Harbour Air' }, 'Harbour Air', '9m']] } };
// The variety contract is read from a deck of a dozen pages up.
const pages = [chart('c0'), roster, ...Array.from({ length: 10 }, (_, i) => chart('c' + (i + 2)))];
const [found] = compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd', players }, pages }).findings.filter((f) => f.code === 'PLAYERS_UNMARKED');
console.log(JSON.stringify({ measured: found.measured, repair: found.repair }));
""")
        self.assertEqual(result["measured"]["unmarked"], ["Cobalt Jet"])
        repair = result["repair"]
        self.assertIn("The deck declares 3 players in `deck.players` (Northwind Airlines, Harbour Air, Cobalt Jet), and 1 of them shows no mark", repair)
        self.assertIn("on the 3 pages read for it - the cover and the first 3 analytical pages (c0, c1, c2), where none may be left unmarked: Cobalt Jet (logo)", repair)
        self.assertIn("Already introduced: Northwind Airlines, Harbour Air on c1.", repair)
        self.assertIn('a page before c0: `{ "type": "profiles", "form": "logos", "commentary": "none", "exhibit": { "items": [{ "name": "Cobalt Jet" }] } }`', repair)


class BindingTests(unittest.TestCase):
    def test_a_reference_that_does_not_bind_names_the_field_and_the_measures_the_page_may_name(self):
        result = run_node("""
import { bindDeck } from './skills/professional-slides/runtime/bind.mjs';
const years = ['2022', '2023', '2024', '2025'];
const insights = new Map([['i-net', { id: 'i-net', shape: 'series', finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision', strength: 'strong', sources: ['sources/a.csv'], measures: {
  journeys: { unit: 'million', population: 'the network', periods: years, values: [71, 79, 84, 85] },
  trains: { unit: 'trains', population: 'the network', periods: years, values: [410, 420, 455, 460] } } }]]);
const page = { id: 'p1', type: 'trend', form: 'line', evidence: ['i-net'], title: 'Journeys reached a record', commentary: 'none',
  exhibits: [{ type: 'chart.line', heading: 'Journeys', series: [{ measure: 'i-net/journey', name: 'Journeys' }] }],
  metrics: [{ measure: 'i-net/journeys', format: '0', label: 'Journeys' }] };
console.log(JSON.stringify(bindDeck({ deck: {}, pages: [page] }, insights).findings.map((f) => f.repair)));
""")
        joined = " | ".join(result)
        self.assertIn('`exhibits[0]` ("Journeys")\'s `series[0]` names "i-net/journey", which the insight log\'s measures do not hold', joined)
        self.assertIn("the insights in the page's `evidence` record i-net/journeys, i-net/trains", joined)
        self.assertIn('`metrics[0]` ("Journeys") names i-net/journeys, which runs over 4 periods: say which one - `i-net/journeys@2025`', joined)


if __name__ == "__main__":
    unittest.main()
