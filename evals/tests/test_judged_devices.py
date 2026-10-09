"""Devices the composer chooses by what a model reads the content to say.

How a page's led points or untitled-icon cards relate (items-relation) picks
their marking: steps, priorities and a counted set are numbered, options
lettered, parallel categories carry a bold lead or sit under a filled band.
Whether a page's claim rests on a series' change (claim-states-change) puts a
growth arrow on its column chart, as a compound annual rate where the periods
are years three or more apart. Unanswered, each leaves the page as it was.
The arrow keeps clear of what it spans - marks, values, callouts, other
arrows - or becomes a bracket above the plot; the scene refuses a change
arrow run through another annotation's label.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

JUDGE = "import { judgementSession, withJudgements } from './skills/professional-slides/runtime/judgements.mjs';\n"


class MarkingByRelationTests(unittest.TestCase):
    def test_points_are_marked_by_how_they_relate(self):
        result = run_node(JUDGE + """
import { resolvePointsStyle } from './skills/professional-slides/runtime/compose-points.mjs';
const asked = [];
const style = (relation, points, title = 'Four challenges hold back the off-peak') => withJudgements(judgementSession({ oracle: (kind, subject) => {
  if (kind !== 'items-relation') return null; asked.push(subject); return relation; } }), () => resolvePointsStyle({ title }, points));
const led = ['Fleet', 'Crews', 'Track', 'Depot'].map((lead) => ({ lead, text: `${lead} is short of what the plan needs.` }));
console.log(JSON.stringify({
  counted: style('counted', led), sequence: style('sequence', led), ranked: style('ranked', led), alternatives: style('alternatives', led), parallel: style('parallel', led), open: style(null, led),
  two: style('counted', led.slice(0, 2)), unled: style('counted', led.map((p) => p.text)),
  asked: asked[0], times: asked.length }));
""")
        self.assertEqual([result[k] for k in ("counted", "sequence", "ranked", "alternatives")], ["numbered", "numbered", "numbered", "lettered"])
        # Parallel findings, and a question not answered, take the deck's own lead style.
        self.assertIn(result["parallel"], ("prose", "ruled"))
        self.assertEqual(result["open"], result["parallel"])
        # Two points are a pair, and points with no lead are bullets: neither is asked.
        self.assertIn(result["two"], ("prose", "ruled"))
        self.assertEqual(result["unled"], "bulleted")
        self.assertEqual(result["asked"], {"title": "Four challenges hold back the off-peak", "items": ["Fleet", "Crews", "Track", "Depot"]})
        self.assertEqual(result["times"], 6)

    def test_cards_without_icons_take_their_tone_from_how_they_relate(self):
        result = run_node(JUDGE + """
import { composeSlide } from './evals/support/compose.mjs';
const cards = (items, more = {}) => ({ title: 'Four tones the films take', exhibit: { type: 'cards', columns: 2, items, ...more } });
const items = ['DC: comic wish fulfillment', 'DC: noir investigation', 'Marvel: ensemble spectacle', 'Marvel: weary drama'].map((title) => ({ title, points: ['A point about the film that says what it shows.'] }));
const tones = (relation, slide) => { const out = withJudgements(judgementSession({ oracle: (kind) => (kind === 'items-relation' ? relation : null) }), () => composeSlide(slide, 0));
  return [...new Set(JSON.stringify(out).match(/"tone":"[a-z-]+"/g) || [])]; };
console.log(JSON.stringify({ parallel: tones('parallel', cards(items)), sequence: tones('sequence', cards(items)), counted: tones('counted', cards(items)), open: tones(null, cards(items)),
  authored: tones('parallel', cards(items, { tone: 'numbered' })), icons: tones('parallel', cards(items.map((item) => ({ ...item, icon: 'film' })))) }));
""")
        self.assertIn('"tone":"header"', result["parallel"])
        self.assertIn('"tone":"big-number"', result["sequence"])
        self.assertIn('"tone":"numbered"', result["counted"])
        # Unanswered, the cards are as written: the renderer's default tone, set nowhere here.
        self.assertNotIn('"tone":"header"', result["open"])
        # An author's tone and cards with icons are never asked.
        self.assertIn('"tone":"numbered"', result["authored"])
        self.assertNotIn('"tone":"header"', result["icons"])

    def test_cards_that_print_no_figure_count_as_text(self):
        result = run_node("""
import { pageFamily } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const page = (items, tone) => ({ id: 'p', exhibit: { type: 'cards', ...(tone ? { tone } : {}), items } });
console.log(JSON.stringify([pageFamily(page([{ title: 'A', text: 'x' }, { title: 'B', text: 'y' }], 'header')),
  pageFamily(page([{ title: 'A', value: '12%' }, { title: 'B', value: '9%' }])), pageFamily(page([{ title: 'A', value: '12%' }, { title: 'B', value: '9%' }], 'stat'))]));
""")
        self.assertEqual(result, ["text", "numbers", "numbers"])


class GrowthByClaimTests(unittest.TestCase):
    def test_a_claim_about_the_series_change_draws_its_rate(self):
        result = run_node(JUDGE + """
import { changeFromContent } from './skills/professional-slides/runtime/compose-charts.mjs';
const asked = [];
const chart = (categories, values, more = {}) => ({ type: 'chart.column', heading: 'Journeys, million', categories, series: [{ name: 'Journeys', values }], ...more });
const read = (answer, ex, title = 'Journeys grew every year since 2019') => withJudgements(judgementSession({ oracle: (kind, subject) => {
  if (kind !== 'claim-states-change') return null; asked.push(subject); return answer; } }), () => changeFromContent(ex, title)).changeAnnotations ?? null;
const years = ['2019', '2020', '2021', '2022', '2023', '2024'], values = [40, 42, 44, 47, 50, 53];
console.log(JSON.stringify({
  cagr: read({ verdict: 'states-change', from: '2019', to: '2024' }, chart(years, values)),
  near: read({ verdict: 'states-change', from: '2022', to: '2024' }, chart(years, values)),
  other: read('other-claim', chart(years, values)), open: read(null, chart(years, values)),
  short: read('states-change', chart(years.slice(0, 3), values.slice(0, 3))), line: read('states-change', { ...chart(years, values), type: 'chart.line' }),
  optedOut: read('states-change', chart(years, values, { change: false })),
  panel: withJudgements(judgementSession({ oracle: (kind, subject) => { if (kind === 'claim-states-change') asked.push(subject); return 'states-change'; } }),
    () => changeFromContent(chart(years, values), 'Journeys grew every year since 2019', { infer: false })).changeAnnotations ?? null,
  subject: asked[0], times: asked.length }));
""")
        self.assertEqual(result["cagr"], [{"start": "2019", "end": "2024", "style": "arrow", "text": "+5.8% p.a."}])
        # Two years apart is a change, not a rate.
        self.assertEqual(result["near"][0]["text"], "+13%")
        # Not inferred on a chart among several panels (compose-passes.mjs: a page's lone chart only), nor asked about there.
        self.assertEqual([result["other"], result["open"], result["short"], result["line"], result["optedOut"], result["panel"]], [None] * 6)
        self.assertEqual(result["subject"], {"title": "Journeys grew every year since 2019", "series": "Journeys", "periods": ["2019", "2020", "2021", "2022", "2023", "2024"]})
        # Asked of a column chart of four periods or more the author marked nothing on: not of three periods, a line, or `change: false`.
        self.assertEqual(result["times"], 4)


class ArrowClearanceTests(unittest.TestCase):
    def test_an_arrow_keeps_clear_of_what_it_spans_or_becomes_a_bracket(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderChangeAnnotations } from './skills/professional-slides/runtime/chart-annotations.mjs';
const column = REGISTRY.get('chart.column'), frame = { x: 60, y: 120, width: 900, height: 420 };
const nodes = column.render({ id: 'c', frame, props: { categories: ['2019', '2020', '2021', '2022', '2023'], series: [{ name: 'Trips', values: [40, 99, 100, 98, 50] }], dataLabels: true,
  changeAnnotations: [{ style: 'arrow', start: '2019', end: '2023', text: '+25%' }] } }).nodes;
const pill = nodes.find((n) => n.role === 'annotation-surface');
const hit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const under = nodes.filter((n) => ['chart-mark', 'data-label'].includes(n.role) && hit(n.frame, pill.frame)).map((n) => n.id);
// A callout set in the band above the plot, over a full-height bar between the two ends: nothing lifts the arrow clear of both.
const plot = { x: 0, y: 40, width: 600, height: 300 }, pointMap = new Map([['category:A', { x: 50, y: 200 }], ['category:B', { x: 550, y: 200 }]]);
const wall = { role: 'annotation-surface', frame: { x: 280, y: -60, width: 40, height: 400 } };
const styles = (obstacles, arrowOnly = false) => [...new Set(renderChangeAnnotations({ id: 'x', plot, props: { changeAnnotations: [{ style: 'arrow', start: 'A', end: 'B', text: '+25%' }] }, pointMap, obstacles, arrowOnly })
  .filter((n) => n.data?.annotationStyle).map((n) => n.data.annotationStyle))];
console.log(JSON.stringify({ style: [...new Set(nodes.filter((n) => n.data?.annotationStyle).map((n) => n.data.annotationStyle))], under, open: styles([]), walled: styles([wall]), lineAxis: styles([wall], true) }));
""")
        # Over a peak, the arrow lifts into the band above the plot and its label sits on no bar and no value.
        self.assertEqual(result["style"], ["arrow"])
        self.assertEqual(result["under"], [])
        # Where nothing lifts it clear, the change is read from a bracket - except on a line read off its value axis, which
        # takes the arrow only.
        self.assertEqual([result["open"], result["walled"], result["lineAxis"]], [["arrow"], ["bracket"], ["arrow"]])

    def test_a_change_arrow_through_another_annotations_label_is_refused(self):
        result = run_node("""
import { sceneCollisions } from './skills/professional-slides/runtime/validate-overlap.mjs';
const text = (key) => ({ id: `t-${key}`, type: 'text', role: 'annotation-text', text: '+12%', frame: { x: 100, y: 100, width: 60, height: 20 }, data: { annotationKey: key } });
const shaft = (key) => ({ id: `l-${key}`, type: 'line', role: 'annotation-leader', frame: { x: 80, y: 110, width: 100, height: 0 }, data: { x1: 80, y1: 110, x2: 180, y2: 110, annotationKey: key } });
const codes = (nodes) => sceneCollisions({ id: 's', nodes }).filter((f) => f.code === 'TEXT_ON_LINE').length;
console.log(JSON.stringify({ own: codes([text('a'), shaft('a')]), other: codes([text('a'), shaft('b')]) }));
""")
        self.assertEqual(result, {"own": 0, "other": 1})


if __name__ == "__main__":
    unittest.main()
