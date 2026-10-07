"""A number on a page states the number recorded: typed, plotted or written by the runtime.

An independent review of the binding found four ways a page could misstate a
record and pass. A typed value was read "on the scale of its series", so 3
stated 3.4 beside a 21; a `{{...}}` token or a bound metric printed whatever
its format made of the value - 0% for 0.49, a billion for a million - and
nothing read it back; a series joined from a scenario and a record took its
order, and its values, from whichever was listed first; and a typed "1,600bn"
was traced to 1.6 kept in billions because the scale was never compared with
the unit. These hold the repair: one rule for every printed number - two
significant figures of the value, a percentage to one decimal place - a scale
that must agree with the unit's, a joined axis in period order with the record
kept, and every assumption a page shows said on the page or to its critic.
"""
import unittest

from node_probe import run_node

LOG = '''
import { bindDeck } from './skills/professional-slides/runtime/bind.mjs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { dependencyFindings, dependencyNotes } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
const FY = ['FY22', 'FY23', 'FY24', 'FY25'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: ['sources/a.csv'] };
const items = [
  { ...graded, id: 'i1', shape: 'series', measures: {
      margin: { unit: '%', population: 'the company', periods: FY, values: [0.49, 3.4, 2.6, -0.86] },
      points: { unit: 'percentage points', population: 'the company', period: 'FY25', value: -0.86 },
      swing: { unit: 'GBP m', population: 'the company', periods: FY, values: [3.4, 2.6, 21.4, 0.6] },
      big: { unit: 'm', population: 'the company', periods: ['FY24', 'FY25'], values: [3.4, 120] },
      rev: { unit: 'CHF bn', population: 'the company', periods: FY, values: [1.3, 1.4, 1.5, 1.6] },
      revm: { unit: 'CHF m', population: 'the company', periods: FY, values: [1300, 1400, 1500, 1600] },
      conversion: { unit: 'ratio', population: 'the company', period: 'FY25', value: 0.571 },
      visits: { unit: 'visits', population: 'the company', period: 'FY25', value: 1300000 },
      staff: { unit: 'employees', population: 'the company', period: 'FY25', value: 126604 } } },
  { ...graded, id: 'i2', shape: 'series', measures: {
      plan: { unit: 'CHF bn', population: 'the company', periods: ['FY24', 'FY25', 'FY26', 'FY27'], values: [9.9, 9.9, 2.0, 2.1], assumed: true, rationale: 'the plan the board approved in March' },
      peers: { unit: 'CHF bn', population: 'four rivals', period: 'FY25', members: ['A', 'B', 'C', 'D'], values: [5, 4, 3, 9], assumed: true, rationale: 'an estimate made by the team' },
      cap: { unit: 'CHF bn', population: 'the company', period: 'FY25', value: 1.55, assumed: true, rationale: 'an estimate made by the team' },
      late: { unit: 'CHF bn', population: 'the company', periods: ['FY23', 'FY24'], values: [7, 8], assumed: true, rationale: 'a restated plan for two years' },
      wave: { unit: 'CHF bn', population: 'the company', periods: ['wave one', 'wave two'], values: [1, 2] },
      next: { unit: 'CHF bn', population: 'the company', periods: ['wave two', 'wave three'], values: [5, 3], assumed: true, rationale: 'the plan for the next wave' } } }];
const insights = new Map(items.map((i) => [i.id, i]));
const base = { id: 'p1', type: 'trend', form: 'line', commentary: 'so-what-bar', why: 'The movement over time is the claim, so the series is drawn', evidence: ['i1', 'i2'],
  title: 'Revenue rose every year while the margin slipped away', bar: 'The margin, not the revenue, is what the next plan has to mend first',
  settles: { kind: 'rate', what: 'revenue at each year end', measures: ['i1/rev'] } };
const bind = (o) => { const out = bindDeck({ deck: {}, pages: [{ ...base, ...o }] }, insights); return { page: out.doc.pages[0], says: out.findings.map((f) => f.repair), bound: out.bound }; };
const says = (o) => bind(o).says;
const codes = (o) => dependencyFindings({ deck: {}, pages: [{ ...base, ...o }] }, insights).map((f) => f.code);
// A title's number no record holds is refused (TITLE_NUMBER_UNTRACED), any other advised (NUMBER_UNTRACED): both are read here as one trace.
const untraced = (o) => dependencyFindings({ deck: {}, pages: [{ ...base, ...o }] }, insights).flatMap((f) => f.code === 'NUMBER_UNTRACED' ? f.measured : f.code === 'TITLE_NUMBER_UNTRACED' ? f.measured.map((shown) => `title: ${shown}`) : []);
const rev = { heading: 'Revenue', series: [{ measure: 'i1/rev', name: 'Revenue' }] };
'''


class TypedNumberTests(unittest.TestCase):
    def test_a_typed_number_keeps_two_figures_of_its_own_value_and_a_percentage_one_decimal_place(self):
        result = run_node(LOG + '''
const plotted = (values) => codes({ settles: { kind: 'rate', what: 'the swing', measures: ['i1/swing'] }, exhibit: { heading: 'Swing', unit: 'GBP m', categories: FY, series: [{ name: 'Swing', values }], basis: { measures: ['i1/swing'] } } });
const metric = (value, ref) => codes({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, settles: { kind: 'rate', what: 'w', measures: [ref] }, metrics: [{ value, label: 'A figure', basis: { measures: [ref] } }], exhibit: rev })
  .filter((code) => code === 'BASIS_VALUES');
console.log(JSON.stringify({
  plotted: { whole: plotted([3, 3, 21, 1]), exact: plotted([3.4, 2.6, 21.4, 0.6]), wrong: plotted([4, 2, 21, 0]) },
  percent: Object.fromEntries(['3%', '3.4%', '-0.9%', '-1%', '-0.86%'].map((v) => [v, metric(v, v.startsWith('-') ? 'i1/margin' : 'i1/margin')])),
  points: Object.fromEntries(['-0.9', '-1'].map((v) => [v, metric(v, 'i1/points')])),
  beside: Object.fromEntries(['3', '3.4'].map((v) => [v, metric(v, 'i1/big')])) }));
''')
        # 3 does not state 3.4 because a 21.4 stands in the same series: the allowance "on the measure's largest value" is gone.
        self.assertEqual(result["plotted"], {"whole": ["BASIS_VALUES"], "exact": [], "wrong": ["BASIS_VALUES"]})
        self.assertEqual(result["beside"], {"3": ["BASIS_VALUES"], "3.4": []})
        # The one exception: a percentage, or percentage points, to one decimal place.
        self.assertEqual(result["percent"], {"3%": ["BASIS_VALUES"], "3.4%": [], "-0.9%": [], "-1%": ["BASIS_VALUES"], "-0.86%": []})
        self.assertEqual(result["points"], {"-0.9": [], "-1": ["BASIS_VALUES"]})

    def test_a_typed_scale_is_held_to_the_scale_the_unit_names(self):
        result = run_node(LOG + '''
const title = (text) => untraced({ title: text });
console.log(JSON.stringify({
  wrong: title('Revenue reached CHF 1600bn by the end of the plan period'), billions: title('Revenue reached CHF 1.6bn by the end of the plan period'),
  millions: title('Revenue reached CHF 1,600m by the end of the plan period'), words: title('Revenue reached 1.6 billion francs by the end of the plan period'),
  // A unit that names no scale is whole units: 1.3m visits is 1,300,000 visits.
  unscaled: title('The sites took 1.3m visits in the last year of the plan'),
  // A percentage typed for a recorded ratio, a hundred times over; not for a quantity that happens to hold the digits.
  ratio: title('Conversion reached 57% of the visits in the last year'), money: title('A share of 1.6% of the visits came in the last year') }));
''')
        self.assertEqual(result["wrong"], ["title: 1600bn"])  # neither 1.6 kept in billions nor 1,600 kept in millions
        self.assertEqual([result["billions"], result["millions"], result["words"], result["unscaled"]], [[], [], [], []])
        self.assertEqual(result["ratio"], [])
        self.assertEqual(result["money"], ["title: 1.6%"])

    def test_a_unit_that_names_no_scale_is_whole_units(self):
        # "visits", "employees" and "km" name no scale, and any scaled figure
        # used to state them a thousand, a million or a billion times over:
        # "1.3bn visits" passed for 1,300,000, and a token printed it so.
        result = run_node(LOG + '''
import { unitScale } from './skills/professional-slides/runtime/printed-numbers.mjs';
const title = (text) => untraced({ title: text });
const token = (text) => { const out = bind({ title: text }); return [out.page.title === text ? null : out.page.title, out.says.join(' | ')]; };
console.log(JSON.stringify({
  scales: ['visits', 'employees', 'km', 'USD', 'GBP m', 'journeys, thousands', 'CHF bn', 'm per clinic', 'AED per m passengers', '', 'm or bn'].map((unit) => unitScale(unit)), none: unitScale(null),
  typed: { million: title('The sites took 1.3m visits in the last year of the plan'), thousand: title('The sites took 1,300k visits in the last year of the plan'), plain: title('The sites took 1,300,000 visits in the last year'),
    k: title('The sites took 1.3k visits in the last year of the plan'), words: title('The sites took 1.3 thousand visits in the last year'),
    staff: ['126.6k', '126,604', '126.6m', '126.6bn', '0.13m'].map((figure) => title(`The company employed ${figure} staff in the last year`)) },
  token: [token('The sites took {{i1/visits | 0.0m | /1000000}} visits in the year'), token('The sites took {{i1/visits | 0,0k | /1000}} visits in the year'), token('The sites took {{i1/visits | 0,0}} visits in the last year'),
    token('The sites took {{i1/visits | 0.0m | /1000}} visits in the year'), token('The sites took {{i1/visits | 0.0bn | /1000000}} visits in the year'), token('The sites took {{i1/visits | 0.0m}} visits in the last year'),
    token('The sites took {{i1/visits | 0,0 | /1000}} million visits in the year')] }));
''')
        self.assertEqual(result["scales"], [1, 1, 1, 1, 1e6, 1e3, 1e9, 1e6, 1, None, None])
        self.assertIsNone(result["none"])
        typed = result["typed"]
        self.assertEqual([typed["million"], typed["thousand"], typed["plain"]], [[], [], []])
        self.assertEqual([typed["k"], typed["words"]], [["title: 1.3k"], ["title: 1.3 thousand"]])
        self.assertEqual(typed["staff"], [[], [], ["title: 126.6m"], ["title: 126.6bn"], []])  # 0.13m is 126,604 to two figures
        token = result["token"]
        self.assertEqual([row[0] for row in token], ["The sites took 1.3m visits in the year", "The sites took 1,300k visits in the year", "The sites took 1,300,000 visits in the last year", None, None, None, None])
        for row in token[3:]:
            self.assertIn("is recorded in visits, which names no scale and so is in whole units", row[1])
        self.assertIn('the modifier between the two scales is "/1000000"', token[3][1])
        self.assertIn('write "0.0m | /1000000"', token[3][1])
        self.assertIn('the modifier between the two scales is "/1000000000"', token[4][1])
        self.assertIn('prints i1/visits as "million"', token[6][1])  # the scale typed after the token

    def test_braces_that_name_no_measure_are_the_authors_own_text(self):
        result = run_node(LOG + '''
const own = bind({ title: 'Revenue for {{client}} reached {{i1/rev@FY25 | CHF 0.0bn}} on page {{page:p9}}' });
const typo = bind({ title: 'Revenue reached {{i9/none | 0.0}} in the last year of the plan' });
console.log(JSON.stringify({ own: [own.page.title, own.says], typo: typo.says.length, traced: untraced({ title: 'Revenue for {{client 2}} reached {{i1/rev@FY25 | CHF 0.0bn}} in the year' }) }));
''')
        self.assertEqual(result["own"], ["Revenue for {{client}} reached CHF 1.6bn on page {{page:p9}}", []])
        self.assertEqual(result["typo"], 1)  # text that parses as a measure reference is a token, and one that does not bind is refused
        self.assertEqual(result["traced"], [])


class PrintedByReferenceTests(unittest.TestCase):
    def test_a_token_or_a_bound_figure_that_would_misstate_its_value_is_refused_with_the_format_that_states_it(self):
        result = run_node(LOG + '''
const token = (text) => { const out = bind({ title: text }); return [out.page.title === text ? null : out.page.title, out.says.join(' | ')]; };
const metric = (measure, format) => { const out = bind({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, metrics: [{ measure, format, label: 'A figure' }], exhibit: rev }); return [out.page.metrics[0].value ?? null, out.says.join(' | ')]; };
console.log(JSON.stringify({
  precision: [token('Margin was {{i1/margin@FY22 | 0%}} in the first year of the plan'), token('Margin was {{i1/margin@FY23 | 0%}} in the second year'), token('Margin was {{i1/margin@FY22 | 0.0%}} then {{i1/margin@FY25 | 0.0%}}'),
    token('The swing was {{i1/swing@FY25 | 0}} million in the last year'), token('The swing was {{i1/swing@FY24}} million in the third year')],
  scale: [token('Revenue reached {{i1/rev@FY25 | CHF 0.0bn | /1000}} in the year'), token('Revenue reached {{i1/revm@FY25 | CHF 0,0bn}} in the year'), token('Revenue reached {{i1/revm@FY25 | CHF 0.0bn | /1000}} in the year'),
    token('Revenue reached {{i1/revm@FY25 | 0,0}} million in the last year'), token('Revenue reached {{i1/revm@FY25 | 0,0}} billion in the last year'), token('Revenue reached {{i1/revm@FY25 | 0.0 | /1000}} billion in the year')],
  hundred: [token('Margin was {{i1/margin@FY23 | 0% | x100}} in the second year'), token('Conversion was {{i1/conversion | 0% | x100}} in the last year'), token('Revenue was {{i1/rev@FY25 | 0 | x100}} in the last year')],
  metric: [metric('i1/margin@FY23', '0%'), metric('i1/margin@FY23', '0.0%'), metric('i1/revm@FY25', 'CHF 0.0bn'), metric('i1/revm@FY25', 'CHF 0.0bn | /1000')] }));
''')
        p = result["precision"]
        self.assertEqual([row[0] for row in p], [None, None, "Margin was 0.5% then -0.9%", None, "The swing was 21.4 million in the third year"])
        self.assertIn("prints 0% for 0.49 %", p[0][1])
        self.assertIn('The format "0.0%" states it', p[0][1])
        self.assertIn("prints 3% for 3.4 %", p[1][1])
        self.assertIn("prints 1 for 0.6 GBP m", p[3][1])  # two significant figures of the value itself
        self.assertIn('The format "0.0" states it', p[3][1])
        s = result["scale"]
        self.assertEqual([row[0] for row in s], [None, None, "Revenue reached CHF 1.6bn in the year", "Revenue reached 1,600 million in the last year", None, "Revenue reached 1.6 billion in the year"])
        self.assertIn("the two are one scale, so no modifier scales it", s[0][1])
        self.assertIn('write "CHF 0.0bn"', s[0][1])
        self.assertIn('the modifier between the two scales is "/1000"', s[1][1])
        self.assertIn('write "CHF 0,0bn | /1000"', s[1][1])
        self.assertIn('prints i1/revm as "billion"', s[4][1])  # the scale typed after the token is read as the format's own would be
        h = result["hundred"]
        self.assertEqual([row[0] for row in h], [None, "Conversion was 57% in the last year", None])
        self.assertIn("a percentage is printed as it is recorded", h[0][1])
        self.assertIn("x100 prints a ratio or a fraction as a percentage and nothing else", h[2][1])
        m = result["metric"]
        self.assertEqual([row[0] for row in m], [None, "3.4%", None, "CHF 1.6bn"])
        self.assertIn("metric 1", m[0][1])
        self.assertIn('The format "0.0%" states it', m[0][1])

    def test_a_refused_format_is_a_binding_the_compile_reports(self):
        result = run_node(LOG + '''
const found = dependencyFindings({ deck: {}, pages: [{ ...base, title: 'Margin was {{i1/margin@FY23 | 0%}} in the second year of the plan' }] }, insights);
console.log(JSON.stringify(found.map((f) => [f.code, f.severity, f.measured])));
''')
        self.assertEqual(result, [["BINDING_UNRESOLVED", "blocker", ["i1/margin"]]])


class JoinTests(unittest.TestCase):
    def test_a_joined_axis_runs_in_period_order_and_the_record_is_kept(self):
        result = run_node(LOG + '''
const join = (measure, more = {}) => { const out = bind({ exhibit: { heading: 'Revenue', series: [{ measure, name: 'Revenue' }], ...more } }); return [out.page.exhibit.categories ?? null, out.page.exhibit.series[0].values ?? null, out.page.exhibit.periods ?? null, out.says.join(' | ')]; };
console.log(JSON.stringify({ forward: join(['i1/rev', 'i2/plan']), backward: join(['i2/plan', 'i1/rev']),
  middle: join(['i1/rev', 'i2/late']), narrowed: join(['i2/late', 'i1/rev'], { select: { to: 'FY24' } }), unread: join(['i2/next', 'i2/wave']) }));
''')
        expected = [["FY22", "FY23", "FY24", "FY25", "FY26", "FY27"], [1.3, 1.4, 1.5, 1.6, 2, 2.1],
                    [{"from": "FY22", "to": "FY25", "label": "Recorded"}, {"from": "FY26", "to": "FY27", "label": "Assumed"}], ""]
        self.assertEqual(result["forward"], expected)
        # Listed the other way round the series is the same: in period order, the record kept where both hold a year, the bracket forward.
        self.assertEqual(result["backward"], expected)
        # Labels that are no dates are merged by each measure's own order: wave three follows wave two.
        self.assertEqual(result["unread"][:2], [["wave one", "wave two", "wave three"], [1, 2, 3]])
        self.assertEqual(result["unread"][2], [{"from": "wave one", "to": "wave two", "label": "Recorded"}, {"from": "wave three", "to": "wave three", "label": "Assumed"}])

    def test_an_assumed_run_that_is_not_the_end_of_the_axis_is_refused(self):
        result = run_node(LOG + '''
// An assumed measure alone over two years, beside the record that runs past it: the assumed years would sit in the middle of the axis.
const out = bind({ exhibit: { heading: 'Revenue', series: [{ measure: 'i1/rev', name: 'Recorded' }, { measure: 'i2/late', name: 'Restated plan' }], select: { from: 'FY23', to: 'FY24' } } });
const mixed = bind({ exhibit: { heading: 'Revenue', series: [{ measure: ['i2/late', 'i2/plan'], name: 'Plans' }, { measure: 'i1/rev', name: 'Recorded' }] } });
const holes = (() => { const log = new Map([...insights, ['i3', { ...graded, id: 'i3', shape: 'series', measures: {
    early: { unit: 'CHF bn', population: 'the company', periods: ['FY22', 'FY23'], values: [5, 6], assumed: true, rationale: 'an early estimate, since restated' },
    later: { unit: 'CHF bn', population: 'the company', periods: ['FY24', 'FY25'], values: [7, 8] } } }]]);
  return bindDeck({ deck: {}, pages: [{ ...base, evidence: ['i3'], exhibit: { heading: 'Revenue', series: [{ measure: ['i3/later', 'i3/early'], name: 'Revenue' }] } }] }, log).findings.map((f) => f.repair); })();
console.log(JSON.stringify({ whole: out.says, ends: [out.page.exhibit.categories ?? null], holes }));
''')
        self.assertEqual(len(result["holes"]), 1)
        self.assertIn("FY22, FY23 rest on an assumption (i3/early) and FY24, FY25 after are recorded", result["holes"][0])
        self.assertIn("the assumed periods of an exhibit are one run at the end of its axis", result["holes"][0])
        # Two series over the same years, one of them assumed throughout: every year drawn is assumed, which is one run to the end.
        self.assertEqual(result["whole"], [])


class AssumptionTests(unittest.TestCase):
    def test_an_assumed_measure_is_said_on_the_page_or_in_its_notes(self):
        result = run_node(LOG + '''
const strip = (metrics, more = {}) => bind({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, metrics, exhibit: rev, ...more });
const bound = strip([{ measure: 'i2/cap', format: 'CHF 0.00bn', label: 'Ceiling' }, { measure: 'i2/cap', format: 'CHF 0.00bn', label: 'Ceiling', sublabel: 'FY25' }, { measure: 'i2/cap', format: 'CHF 0.00bn', label: 'Assumed ceiling' },
  { measure: 'i1/rev@FY25', format: 'CHF 0.0bn', label: 'Revenue' }, { value: 'CHF 1.55bn', label: 'Ceiling, typed', basis: { measures: ['i2/cap'] } }]);
const members = bind({ type: 'ranking', form: 'bar', exhibit: { heading: 'Rivals by revenue', series: [{ measure: 'i2/peers', name: 'Rival revenue' }] } });
const said = bind({ type: 'ranking', form: 'bar', exhibit: { heading: 'Rivals by revenue, as the team assumes it', series: [{ measure: 'i2/peers', name: 'Rival revenue' }] } });
const rule = bind({ note: 'Fiscal years to March', exhibit: { heading: 'Revenue', series: [{ measure: 'i1/rev', name: 'Revenue' }, { measure: 'i2/cap', name: 'Ceiling' }] } });
const joined = bind({ exhibit: { heading: 'Revenue', series: [{ measure: ['i1/rev', 'i2/plan'], name: 'Revenue' }] } });
const token = bind({ title: 'The ceiling of {{i2/cap | 0.00}} billion holds, and the margin fell {{i1/margin@FY25 | 0.0% | abs}}' });
const compiled = compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How has revenue moved?' },
  pages: [{ ...base, title: 'The ceiling of {{i2/cap | 0.00}} billion holds while the margin fell {{i1/margin@FY25 | 0.0% | abs}}', exhibit: { heading: 'Revenue', series: [{ measure: 'i1/rev', name: 'Revenue' }, { measure: 'i2/cap', name: 'Ceiling' }] } }] }, { insights, partial: true });
const slide = compiled.spec.slides[0];
console.log(JSON.stringify({ sublabels: bound.page.metrics.map((m) => m.sublabel ?? null), says: bound.says,
  members: members.page.note ?? null, said: said.page.note ?? null, rule: rule.page.note, joined: [joined.page.note ?? null, joined.bound.assumed.get(joined.page)],
  token: [token.page.title, token.page.note ?? null, token.bound.assumed.get(token.page), token.bound.unsigned.get(token.page)],
  compiled: [compiled.compileErrors, slide?.note ?? null, slide?.pageType.content.settles.stated ?? null, slide ? dependencyNotes({ bases: [], settles: slide.pageType.content.settles }) : null] }));
''')
        self.assertEqual(result["says"], [])
        # A metric: the sublabel says so unless the author's own words already do; a recorded one is left alone.
        self.assertEqual(result["sublabels"], ["Assumed", "FY25 (assumed)", None, None, "Assumed"])
        # A chart of an assumed peer set and an assumed rule across the plot: a note line, unless the exhibit's own words say it.
        self.assertEqual(result["members"], "Assumed, not recorded: Rival revenue.")
        self.assertIsNone(result["said"])
        self.assertEqual(result["rule"], "Fiscal years to March. Assumed, not recorded: Ceiling.")
        # A joined run is bracketed on the chart, which says it: no note, and the page's record names the bracket.
        self.assertEqual(result["joined"], [None, [{"ref": "i2/plan", "said": "the bracket over the assumed periods", "rationale": "the plan the board approved in March"}]])
        # A token only prints: nothing is drawn, and the binding records the assumption and the sign it dropped.
        title, note, assumed, unsigned = result["token"]
        self.assertEqual([title, note], ["The ceiling of 1.55 billion holds, and the margin fell 0.9%", None])
        self.assertEqual(assumed, [{"ref": "i2/cap", "said": None, "rationale": "an estimate made by the team"}])
        self.assertEqual(unsigned, [{"ref": "i1/margin", "shown": "0.9%", "recorded": -0.86}])
        # The compiled deck keeps both with what settles the claim, and the notes the critic reads list them.
        errors, note, stated, notes = result["compiled"]
        self.assertEqual(errors, [])
        self.assertIn("Assumed, not recorded: Ceiling.", note)
        self.assertEqual(stated["assumed"], [{"ref": "i2/cap", "said": "the page's note", "rationale": "an estimate made by the team"}])
        self.assertEqual(stated["unsigned"], [{"ref": "i1/margin", "shown": "0.9%", "recorded": -0.86}])
        self.assertEqual(notes, ['i2/cap is assumed, not recorded ("an estimate made by the team") - said on the page by the page\'s note',
                                 'i1/margin is printed without its sign: "0.9%" for a recorded -0.86'])

    def test_a_negated_assumed_does_not_stand_for_the_mark(self):
        # "audited, not assumed" under an assumed figure matched the word and
        # suppressed the runtime's mark: the page then said the opposite of its record.
        result = run_node(LOG + '''
const strip = (sublabels) => bind({ type: 'numbers', form: 'metric-strip', commentary: 'none', bar: undefined, exhibit: rev, metrics: sublabels.map((sublabel) => ({ measure: 'i2/cap', format: 'CHF 0.00bn', label: 'Ceiling', sublabel })) });
const negated = ['audited, not assumed', 'unassumed', 'no assumption made', 'never assumed', 'recorded rather than assumed', "isn't an assumption", 'Not assumed'];
const affirmed = ['assumed by the team', 'an assumption', 'assumes 3% a year', 'not audited: assumed by the team in the March plan'];
const peers = (heading) => bind({ type: 'ranking', form: 'bar', exhibit: { heading, series: [{ measure: 'i2/peers', name: 'Rival revenue' }] } }).page.note ?? null;
console.log(JSON.stringify({ negated: strip(negated).page.metrics.map((m) => m.sublabel), affirmed: strip(affirmed).page.metrics.map((m) => m.sublabel), wanted: [negated, affirmed],
  exhibit: [peers('Rivals by revenue, not assumed'), peers('Rivals by revenue, assumed')] }));
''')
        negated, affirmed = result["wanted"]
        self.assertEqual(result["negated"], [f"{sublabel} (assumed)" for sublabel in negated])
        self.assertEqual(result["affirmed"], affirmed)
        # The same reading of an exhibit's own words: a heading that denies it gets the note line.
        self.assertEqual(result["exhibit"], ["Assumed, not recorded: Rival revenue.", None])


if __name__ == "__main__":
    unittest.main()
