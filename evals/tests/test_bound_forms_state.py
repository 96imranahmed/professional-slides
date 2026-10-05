"""A bound exhibit says what each series is in every form that is written from measures.

The binding tells a chart which of its series are records, which are
assumptions and which are references (bind.mjs, chart-decorations.mjs
SERIES_STATES), and it writes every chart kind from the same references in
the shape that kind reads (shapeBound): a table turned over (`pivot`), small
multiples, a combo on two scales, a slope. These hold the two together: a
form written from measures in its own shape still carries each series' state,
is drawn as assumed where its chart draws series states, says so in the
page's note where it does not, and is never handed a bracket over the assumed
periods that its chart would refuse. Every number such an exhibit draws - a
scatter's points, a bridge's totals and steps, a bullet's targets - is
recorded as stated, so the deck's pages are held to agree on it.
"""
from __future__ import annotations

import unittest

from node_probe import NODE, run_node

FORMS = '''
import { authorDeck, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { bindDeck } from './skills/professional-slides/runtime/bind.mjs';
const worked = workedExamples();
const FY = ['FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26', 'FY27', 'FY28'];
const REGIONS = ['North', 'South', 'East', 'West', 'Centre', 'Coast'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: ['sources/a.csv'], breadth: { members: 6, periods: 8 } };
const estimate = { assumed: true, rationale: 'an estimate made by the team' };
const measures = {
  journeys: { unit: 'million', population: 'the operator', periods: FY.slice(0, 6), values: [14.9, 31.6, 42.8, 46.1, 47.5, 48.3] },
  plan: { unit: 'million', population: 'the operator', periods: FY.slice(6), values: [49.0, 49.6], assumed: true, rationale: 'the plan the board approved in March' },
  north: { unit: 'million', population: 'the north', periods: FY, values: [5, 6, 7, 8, 9, 10, 11, 12] },
  south: { unit: 'million', population: 'the south', periods: FY, values: [4, 5, 5, 6, 7, 8, 9, 9] },
  rival: { unit: 'million', population: 'the rival', periods: FY, values: [20, 25, 30, 36, 41, 45, 50, 55], ...estimate },
  second: { unit: 'million', population: 'the second rival', periods: FY, values: [10, 15, 20, 26, 31, 35, 40, 45], ...estimate },
  third: { unit: 'million', population: 'the third rival', periods: FY, values: [11, 16, 21, 27, 32, 36, 41, 46], ...estimate },
  fourth: { unit: 'million', population: 'the fourth rival', periods: FY, values: [12, 17, 22, 28, 33, 37, 42, 47], ...estimate },
  share: { unit: '%', population: 'the rival, of the market', periods: FY, values: [30, 31, 33, 34, 36, 37, 39, 40], ...estimate },
  actual: { unit: 'million', population: 'the regions', period: 'FY26', members: REGIONS, values: [10, 8, 6, 5, 4, 3] },
  target: { unit: 'million', population: 'the regions, as planned', period: 'FY26', members: REGIONS, values: [11, 8, 7, 5, 5, 3] },
  staff: { unit: 'employees', population: 'the regions', period: 'FY26', members: REGIONS, values: [900, 700, 600, 400, 300, 200] },
  opening: { unit: 'million', population: 'the operator, opening', period: 'FY25', value: 47.5 },
  closing: { unit: 'million', population: 'the operator, closing', period: 'FY26', value: 48.3 },
  drivers: { unit: 'million', population: 'the operator, change by driver', period: 'FY26', members: ['New routes', 'Fares', 'Closures'], values: [1.5, 0.3, -1.0] } };
// The same measures under an insight of each shape, so a page of either kind rests on one it can carry.
const items = [{ ...graded, id: 't', shape: 'series', measures }, { ...graded, id: 'p', shape: 'peer-set', measures }];
const insights = new Map(items.map((i) => [i.id, i]));
const page = (id, log, type, form, exhibit) => ({ id, type, form, commentary: 'so-what-bar', why: 'The comparison is the claim, so it is drawn', evidence: [log],
  bar: 'The plan needs the journeys to keep rising at the pace of the last three years, which the assumed path does not deliver',
  settles: { kind: 'rate', what: 'journeys a year', measures: [`${log}/north`] }, title: `Journeys against the plan, case ${id}`, exhibit: { heading: 'Passenger journeys', ...exhibit } });
const series = (log, names) => names.map((name) => ({ measure: Array.isArray(name) ? name.map((part) => `${log}/${part}`) : `${log}/${name}`, name: [].concat(name)[0] }));
const run = async (pages) => {
  const doc = { deck: { ...worked.deck, id: 'forms' }, pages };
  const bound = bindDeck(doc, insights);
  const result = await authorDeck(doc, { baseDir: '.', insights, fit: false, fill: false });
  const refused = [...result.blocking].filter((f) => ['COMPILE', 'PAGE_DOES_NOT_COMPOSE', 'BINDING_UNRESOLVED'].includes(f.code)).map((f) => [f.id, String(f.repair).slice(0, 200)]);
  return { refused, unbound: bound.findings.map((f) => f.repair.slice(0, 200)), pages: Object.fromEntries(pages.map((p) => {
    const written = bound.doc.pages.find((w) => w.id === p.id), ex = written.exhibit, slide = result.deck.slides.find((s) => (s.sourceSlideId ?? s.id) === p.id), nodes = slide?.nodes ?? [];
    return [p.id, { series: (ex.series ?? ex.items ?? []).map((s) => [s.name ?? s.label, s.state ?? null, s.assumedFrom ?? null]), categories: ex.categories ?? null, bracket: ex.periods ?? null, note: written.note ?? null,
      marks: nodes.filter((n) => n.role === 'chart-mark').length, assumedMarks: nodes.filter((n) => n.role === 'chart-mark' && n.data?.state === 'assumed').length,
      dashed: nodes.filter((n) => n.role === 'chart-line' && n.style?.dash === 'dash').length, key: nodes.filter((n) => /legend-label|end-label/.test(n.role)).map((n) => n.text),
      drawn: (slide?.componentInstances ?? []).map((c) => String(c.component)).filter((c) => c.startsWith('chart.')),
      stated: (bound.bound.stated.get(written) ?? []).map((s) => [s.ref, s.label, s.value]) }]; })) };
};
'''


@unittest.skipUnless(NODE, "needs Node.js")
class BoundFormsCarryStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node(FORMS + '''
console.log(JSON.stringify(await run([
  // A table turned over: four measures along the axis, two periods as the series. Two of the measures are the team's estimates.
  page('mixed', 'p', 'ranking', 'bar', { series: series('p', ['north', 'south', 'rival', 'second']), select: { periods: ['FY25', 'FY26'] }, pivot: true, highlights: [{ category: 'north' }] }),
  // The same, every measure an estimate: each series is an assumption throughout.
  page('all', 'p', 'ranking', 'bar', { series: series('p', ['rival', 'second', 'third', 'fourth']), select: { periods: ['FY25', 'FY26'] }, pivot: true, highlights: [{ category: 'rival' }] }),
  // Small multiples: a record joined to its plan, and an estimate, each an item.
  page('small', 't', 'trend', 'sparklines', { series: series('t', [['journeys', 'plan'], 'rival']), highlights: [{ category: 'journeys' }] }),
  // A slope between two periods, the second of them planned.
  page('slope', 't', 'trend', 'slope', { series: series('t', [['journeys', 'plan'], 'north', 'south', 'rival']), select: { periods: ['FY21', 'FY28'] }, focusSeries: 'journeys' }),
  // A combo on two scales: a recorded level, and an estimated share on a scale of its own.
  page('combo', 't', 'trend', 'combo', { series: series('t', ['north', 'share']), highlights: [{ category: 'FY28' }] }),
])));
''')

    def test_every_form_composes_with_an_assumed_series(self):
        # No form is handed a decoration its chart refuses: a bracket over periods on small multiples or a slope, or over measures on a table turned over.
        self.assertEqual(self.result["unbound"], [])
        self.assertEqual(self.result["refused"], [])
        for key in ("mixed", "all", "small", "slope"):
            self.assertIsNone(self.result["pages"][key]["bracket"], key)

    def test_a_table_turned_over_draws_the_assumed_measures_as_assumed(self):
        mixed, every = self.result["pages"]["mixed"], self.result["pages"]["all"]
        self.assertEqual(mixed["drawn"], ["chart.bar"])
        self.assertEqual(mixed["categories"], ["north", "south", "rival", "second"])
        # Each series is one period across the measures: assumed from the first estimated measure on, where they close the axis.
        self.assertEqual(mixed["series"], [["FY25", None, "rival"], ["FY26", None, "rival"]])
        # Eight bars, and the four of the two estimated measures are drawn as assumed; the two recorded ones are not.
        self.assertEqual([mixed["marks"], mixed["assumedMarks"]], [8, 4])
        self.assertEqual(mixed["note"], "Assumed, not recorded: rival, second.")
        # Every measure an estimate: each series is assumed throughout, drawn so, and its key says it.
        self.assertEqual(every["series"], [["FY25", "assumed", None], ["FY26", "assumed", None]])
        self.assertEqual([every["marks"], every["assumedMarks"]], [8, 8])
        self.assertEqual(every["key"], ["FY25 (assumed)", "FY26 (assumed)"])

    def test_a_combo_on_two_scales_draws_its_assumed_line_dashed_and_keys_it(self):
        combo = self.result["pages"]["combo"]
        self.assertEqual(combo["drawn"], ["chart.combo"])
        self.assertEqual(combo["series"], [["north", None, None], ["share", "assumed", None]])
        self.assertGreater(combo["dashed"], 0)
        self.assertIn("share (assumed)", combo["key"])

    def test_small_multiples_and_a_slope_carry_each_series_state_and_the_page_says_it(self):
        small, slope = self.result["pages"]["small"], self.result["pages"]["slope"]
        # An item of small multiples is its series: it carries what the series is, in the shape the chart reads.
        self.assertEqual(small["drawn"], ["chart.sparklines"])
        self.assertEqual(small["series"], [["journeys", None, "FY27"], ["rival", "assumed", None]])
        # Neither chart draws a series' state or a bracket, so the page's note says which series are assumed, and from when.
        self.assertEqual(small["note"], "Assumed, not recorded: journeys from FY27, rival.")
        self.assertEqual(slope["series"], [["journeys", None, "FY28"], ["north", None, None], ["south", None, None], ["rival", "assumed", None]])
        self.assertEqual(slope["note"], "Assumed, not recorded: journeys from FY28, rival.")

    def test_every_number_a_shaped_exhibit_draws_is_recorded_as_stated(self):
        result = run_node(FORMS + '''
const pages = [
  page('points', 'p', 'relationship', 'scatter', { points: { x: { measure: 'p/actual' }, y: { measure: 'p/staff' } } }),
  page('bullet', 'p', 'ranking', 'bullet', { series: series('p', ['actual']), targets: { measure: 'p/target' } }),
  page('bridge', 't', 'bridge', 'waterfall', { bridge: { from: { measure: 't/opening', name: 'FY25' }, steps: { measure: 't/drivers' }, to: { measure: 't/closing', name: 'FY26' } } })];
const bound = bindDeck({ deck: { ...worked.deck, id: 'forms' }, pages }, insights);
console.log(JSON.stringify({ unbound: bound.findings.map((f) => f.repair.slice(0, 200)),
  stated: Object.fromEntries(bound.doc.pages.map((p) => [p.id, (bound.bound.stated.get(p) ?? []).map((s) => [s.ref, s.label, s.value])])) }));
''')
        self.assertEqual(result["unbound"], [])
        stated = result["stated"]
        # A point is one member's value on each measure.
        self.assertIn(["p/actual", "North", 10], stated["points"])
        self.assertIn(["p/staff", "Coast", 200], stated["points"])
        self.assertEqual(len(stated["points"]), 12)
        # A bullet's bars and the targets set against them.
        self.assertIn(["p/actual", "South", 8], stated["bullet"])
        self.assertIn(["p/target", "North", 11], stated["bullet"])
        # A bridge's totals and its steps.
        self.assertEqual(stated["bridge"], [["t/opening", None, 47.5], ["t/drivers", "New routes", 1.5], ["t/drivers", "Fares", 0.3], ["t/drivers", "Closures", -1.0], ["t/closing", None, 48.3]])


if __name__ == "__main__":
    unittest.main()
