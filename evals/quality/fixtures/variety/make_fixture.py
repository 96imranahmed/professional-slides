"""Writes the variety fixture under evals/quality/fixtures/variety/.

One spine on a fictional subject - a regional rail operator, not the
benchmark's - whose pages between them set every kind of reading task the fit
table knows (runtime/claim-fit.mjs): a trend of one series and of six, two
measures on two scales, a mix over time, a rank, a field of twenty, a pair of
dates, a target, a spread, parts of a whole, a mix between members, two
measures set against each other, a bridge, figures, several cuts side by side
and tables of exact values - with the pages no measure decides (a summary, a
mechanism, parallel points, an argument, options) between them.

The pages declare a type, a claim and the evidence they rest on, and no form,
placement or exhibit: the spine `--plan` allocates. Some claims are carried
equally well by several forms and some by exactly one, which is what
evals/quality/variability.mjs measures: plans under different `variation`
seeds differ on the first and agree on the second.

Run from the repository root; the fixture is committed, this script is how
it was made.
"""
import json
import os

OUT = 'evals/quality/fixtures/variety'
FY = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26']
OPERATORS = ['Northvale', 'Coast', 'Midland', 'Harbour', 'Ridge', 'Lakes', 'Summit', 'Vale', 'Fen', 'Moor']
SO = 'It bears directly on the decision the deck is for'


def ins(id, shape, finding, measures, breadth=None, strength='strong'):
    d = {'id': id, 'finding': finding, 'shape': shape, 'calculation': 'as recorded in the operator returns', 'sources': ['sources/%s.csv' % id], 'soWhat': SO, 'strength': strength, 'measures': measures}
    if breadth:
        d['breadth'] = breadth
    return d


def series(unit, pop, vals, **k):
    return dict(unit=unit, population=pop, periods=FY, values=vals, **k)


def peers(unit, pop, members, vals, period='FY26', **k):
    return dict(unit=unit, population=pop, period=period, members=members, values=vals, **k)


def one(unit, pop, value, period='FY26', **k):
    return dict(unit=unit, population=pop, period=period, value=value, **k)


SIX = OPERATORS[:6]
EIGHT = OPERATORS[:8]
FIELD = ['Operator %s' % chr(65 + i) for i in range(20)]
PARTS = ['peak', 'off-peak', 'weekend']

INSIGHTS = [
    ins('i-journeys', 'series', 'Journeys recovered from 30.2m in FY20 to 52.3m in FY26, 28% above FY19',
        {'journeys': series('m journeys', 'Northvale Rail', [41, 30.2, 33.5, 38.1, 42.4, 45.9, 48.8, 52.3]), 'growth': one('%', 'Northvale Rail journeys, FY19 to FY26', 27.6, period='FY19 to FY26')},
        breadth={'periods': 8, 'series': 1}),
    ins('i-money', 'series', 'Revenue rose to GBP 398m while punctuality held near 90%',
        {'revenue': series('GBP m', 'Northvale Rail', [310, 240, 262, 301, 333, 351, 372, 398]), 'punctuality': series('%', 'Northvale Rail', [88.1, 91.2, 90.4, 89.3, 88.7, 89.9, 90.6, 91.4])},
        breadth={'periods': 8, 'series': 2}),
    ins('i-operators', 'series', 'All six operators grew, Lakes fastest',
        {name.lower(): series('m journeys', name, [round(20 + 6 * k + i * (1.5 + k * 0.4), 1) for i in range(8)]) for k, name in enumerate(SIX)}, breadth={'periods': 8, 'series': 6}),
    ins('i-daypart', 'mix', 'Weekend travel grew from a quarter to a third of journeys',
        {name: series('m journeys', 'Northvale Rail', [10 + 3 * k + i * (1 + k) for i in range(8)]) for k, name in enumerate(PARTS)}, breadth={'parts': 3}),
    ins('i-punctual', 'peer-set', 'Northvale is the most punctual of ten operators at 91.4%',
        {'punctuality': peers('%', 'ten operators', OPERATORS, [91.4, 89.2, 88.7, 87.9, 86.5, 85.1, 84.8, 83.3, 82.9, 81.0])}, breadth={'members': 10}),
    ins('i-then-now', 'peer-set', 'Seven of ten operators carry more journeys than in FY19',
        {'fy19': peers('m journeys', 'ten operators', OPERATORS, [41, 56, 52, 48, 44, 40, 36, 32, 28, 24], period='FY19'), 'fy26': peers('m journeys', 'ten operators', OPERATORS, [52.3, 61, 56, 51, 46, 41, 36, 31, 26, 21])},
        breadth={'members': 10}),
    ins('i-cost-field', 'peer-set', 'Northvale sits fifth of twenty on cost per journey',
        {'cost': peers('GBP per journey', 'twenty operators', FIELD, [round(9.5 - i * 0.3, 1) for i in range(20)])}, breadth={'members': 20}),
    ins('i-response', 'peer-set', 'Five of eight districts miss the nine-minute standard',
        {'response': peers('minutes', 'eight districts', EIGHT, [7.2, 8.1, 8.8, 9.4, 9.9, 10.3, 11.2, 12.6]), 'standard': one('minutes', 'eight districts', 9, standard=True)}, breadth={'members': 8}),
    ins('i-profile', 'peer-set', 'Northvale leads on punctuality and cost, and runs the youngest fleet',
        {'punctuality': peers('%', 'eight operators', EIGHT, [91, 89, 88, 87, 86, 85, 84, 83]), 'cost': peers('GBP per journey', 'eight operators', EIGHT, [6.1, 6.8, 7.2, 7.9, 8.4, 8.8, 9.1, 9.9]),
         'fleet-age': peers('years', 'eight operators', EIGHT, [9, 12, 14, 11, 16, 18, 13, 21])}, breadth={'members': 8}),
    ins('i-frequency', 'measure-pair', 'Lines with more trains a day grew faster',
        {'frequency': peers('trains a weekday', 'ten lines', OPERATORS, [58, 54, 38, 36, 32, 18, 16, 14, 44, 26]), 'growth': peers('%', 'ten lines', OPERATORS, [19, 17, 14, 18, 15, 5, 6, 4, 9, 12])}, breadth={'members': 10}),
    ins('i-revenue-parts', 'mix', 'Fares are 57% of revenue',
        {'revenue': peers('GBP m', 'Northvale Rail revenue', ['Fares', 'Subsidy', 'Freight access', 'Property'], [228, 96, 44, 30])}, breadth={'parts': 4}),
    ins('i-fleet', 'mix', 'Two classes are 43% of the fleet',
        {'fleet': peers('trains', 'Northvale Rail fleet', ['Class 150', 'Class 158', 'Class 170', 'Class 195', 'Class 331', 'Class 769', 'Class 802'], [42, 38, 30, 58, 43, 8, 19])}, breadth={'parts': 7}),
    ins('i-daypart-peers', 'mix', 'Northvale carries the largest weekend share of five operators',
        {name: peers('m journeys', 'five operators', OPERATORS[:5], [8 + 3 * k + 2 * i for i in range(5)]) for k, name in enumerate(PARTS)}, breadth={'parts': 3}),
    ins('i-bridge', 'bridge', 'The new timetable added 2.6m of the 3.5m journeys gained',
        {'journeys': peers('m journeys', 'Northvale Rail', ['FY25', 'New timetable', 'Fares', 'Strikes', 'Weather', 'Events', 'FY26'], [48.8, 2.6, 0.9, -1.1, -0.4, 1.5, 52.3], period='FY25 to FY26')}, breadth={'steps': 5}),
    ins('i-spread', 'peer-set', 'Northvale has the narrowest month-to-month spread of six operators',
        {name: peers('%', "six operators' monthly punctuality", SIX, [78 + 3 * k + i for i in range(6)]) for k, name in enumerate(['min', 'q1', 'median', 'q3', 'max'])}, breadth={'members': 6}),
    ins('i-lines', 'measure-pair', 'Peak journeys are spread evenly across eight lines',
        {name: peers('m journeys', 'eight lines', EIGHT, [8 + 3 * k + ((i * 7) % 5) for i in range(8)]) for k, name in enumerate(PARTS)}, breadth={'members': 8}),
    ins('i-estate', 'fact', 'The network is 214 stations on 12 lines',
        {'stations': one('stations', 'Northvale Rail', 214), 'staff': one('staff', 'Northvale Rail', 6120), 'depots': one('depots', 'Northvale Rail', 9), 'lines': one('lines', 'Northvale Rail', 12)}, strength='supporting'),
]


def page(id, type, title, why, evidence=None, measures=None, kind='comparison', what=None, relation=None):
    d = {'id': id, 'type': type, 'title': title, 'why': '%s, which is what a %s page is for' % (why, type)}
    if evidence:
        d['evidence'] = evidence
        d['settles'] = {'kind': kind, 'what': what or 'the measures the page names, as recorded', 'measures': measures}
        if relation:
            d['settles']['relation'] = relation
    else:
        # A page no measure decides is settled by its reasoning or its structure, and says which.
        d['settles'] = {'kind': kind if kind != 'comparison' else 'qualitative', 'what': what or 'the argument the page sets out, from the findings before it'}
    return d


def refs(insight, *names):
    return ['%s/%s' % (insight, name) for name in names]


PAGES = [
    page('v01', 'summary', 'Northvale has recovered its passengers and should now buy frequency', 'The opening states the answer and its proof'),
    {'kind': 'section', 'title': 'Demand has recovered past its FY19 level'},
    page('v02', 'trend', 'Journeys are 28% above their FY19 level', 'One series over eight years, read for its recovery', ['i-journeys'], refs('i-journeys', 'journeys'), kind='rate'),
    page('v03', 'trend', 'Every operator grew, and Lakes grew fastest', 'Six series over the same years', ['i-operators'], refs('i-operators', *[name.lower() for name in SIX]), kind='rate'),
    page('v04', 'ranking', 'Seven of ten operators carry more than in FY19', 'Two dates for each of ten operators', ['i-then-now'], refs('i-then-now', 'fy19', 'fy26'), relation={'kind': 'gap'}),
    page('v05', 'numbers', 'The recovery took six years from the FY20 low', 'One figure over the series that produced it', ['i-journeys'], refs('i-journeys', 'growth', 'journeys'), kind='rate'),
    page('v06', 'composition', 'Weekend travel grew from a quarter to a third of journeys', 'Three parts of one whole over eight years', ['i-daypart'], refs('i-daypart', *PARTS), kind='share'),
    page('v07', 'bridge', 'The new timetable added most of the journeys gained in FY26', 'A change between two totals and what it is made of', ['i-bridge'], refs('i-bridge', 'journeys'), kind='structure'),
    page('v08', 'mechanism', 'More trains an hour bring passengers who did not plan the trip', 'How frequency turns into demand, as a sequence of causes'),
    {'kind': 'section', 'title': 'Northvale leads its peers on service and cost'},
    page('v09', 'ranking', 'Northvale is the most punctual of ten operators', 'Ten members on one measure', ['i-punctual'], refs('i-punctual', 'punctuality'), kind='rank'),
    page('v10', 'panels', 'Northvale leads on punctuality and cost with the youngest fleet', 'Three measures in three units, each ranked on its own', ['i-profile'], refs('i-profile', 'punctuality', 'cost', 'fleet-age'), relation={'kind': 'separate', 'reason': 'each is in its own unit and read as its own ranking'}),
    page('v11', 'ranking', 'Northvale sits fifth of twenty on cost per journey', 'Where the subject sits in a field of twenty', ['i-cost-field'], refs('i-cost-field', 'cost'), kind='rank'),
    page('v12', 'lookup', 'The eight operators on the three measures the board asked for', 'Exact values a reader looks up', ['i-profile'], refs('i-profile', 'punctuality', 'cost', 'fleet-age'), relation={'kind': 'separate', 'reason': 'exact values in three units, looked up row by row'}),
    page('v13', 'ranking', 'Northvale holds the narrowest spread of monthly punctuality', "Each operator's own range, middle half and median", ['i-spread'], refs('i-spread', 'min', 'q1', 'median', 'q3', 'max'), kind='rank'),
    page('v14', 'relationship', 'Lines with more trains a day grew faster', 'Two measures set against each other, line by line', ['i-frequency'], refs('i-frequency', 'frequency', 'growth')),
    page('v15', 'scorecard', 'Northvale is ahead of seven peers on all three measures', 'Recorded measures over the same members, coded in their cells', ['i-profile'], refs('i-profile', 'punctuality', 'cost', 'fleet-age'), relation={'kind': 'separate', 'reason': 'each measure is coded on its own range'}),
    page('v16', 'options', 'Buy frequency on four lines or spread it across twelve', 'Two options compared on the same terms', kind='structure', what='the two ways of spending the same order, on the same terms'),
    {'kind': 'section', 'title': 'The money and the fleet allow the purchase'},
    page('v17', 'trend', 'Revenue reached GBP 398m with punctuality held near 90%', 'Two measures in two units over the same years', ['i-money'], refs('i-money', 'revenue', 'punctuality'), kind='rate'),
    page('v18', 'composition', 'Fares are 57% of revenue', 'One whole and its four parts', ['i-revenue-parts'], refs('i-revenue-parts', 'revenue'), kind='share'),
    page('v19', 'panels', 'Revenue rose while punctuality held', 'Two series in two units, one above the other', ['i-money'], refs('i-money', 'revenue', 'punctuality'), kind='rate', relation={'kind': 'separate', 'reason': 'pounds and per cent share no scale'}),
    page('v20', 'composition', 'Northvale carries the largest weekend share of five operators', 'The mix of one whole, operator by operator', ['i-daypart-peers'], refs('i-daypart-peers', *PARTS), kind='share'),
    page('v21', 'numbers', 'The network is 214 stations on 12 lines', 'Four single figures', ['i-estate'], refs('i-estate', 'stations', 'staff', 'depots', 'lines'), kind='count'),
    page('v22', 'composition', 'Two classes are 43% of the fleet', 'One whole and its seven parts', ['i-fleet'], refs('i-fleet', 'fleet'), kind='share'),
    page('v23', 'parallel', 'Three things the order has to settle before it is placed', 'Three parallel conditions, each headed'),
    page('v24', 'panels', 'Punctuality leads the peers and fares carry the revenue', 'A rank and the parts of a whole, side by side', ['i-punctual', 'i-revenue-parts'], refs('i-punctual', 'punctuality') + refs('i-revenue-parts', 'revenue'), relation={'kind': 'separate', 'reason': 'a ranking in per cent and a split of pounds'}),
    page('v25', 'ranking', 'Five of eight districts miss the nine-minute standard', 'Each member against a standard', ['i-response'], refs('i-response', 'response', 'standard')),
    page('v26', 'numbers', 'Three districts meet the standard and five do not', 'One standard over the districts it is set for', ['i-response'], refs('i-response', 'standard', 'response')),
    page('v27', 'argument', 'Frequency is the purchase that the evidence supports', 'The reasoning is the evidence'),
    page('v28', 'relationship', 'Peak journeys are spread evenly across eight lines', 'Three measures in one unit across the lines', ['i-lines'], refs('i-lines', *PARTS)),
    page('v29', 'panels', 'Journeys recovered on a fleet two classes dominate', 'A trend and the parts of a whole, side by side', ['i-journeys', 'i-fleet'], refs('i-journeys', 'journeys') + refs('i-fleet', 'fleet'), relation={'kind': 'separate', 'reason': 'journeys over time and trains by class'}),
    page('v30', 'lookup', 'Journeys by operator, year by year', 'Exact values in one unit', ['i-operators'], refs('i-operators', *[name.lower() for name in SIX]), kind='rate'),
    page('v31', 'summary', 'Buy frequency on the four busiest lines first', 'What to keep, at the close'),
]

DECK = {
    'schema': 'professional-slides.deck/v3', 'id': 'variety', 'workflow': 'new_deck',
    'request': 'Has Northvale Rail recovered, how does it compare with other operators, and what should it buy next?',
    'brief': 'Has Northvale Rail recovered, and what should it buy next?',
    'answer': 'Northvale has recovered past its FY19 level and leads its peers, so it should buy frequency on its four busiest lines.',
    'design': 'consulting', 'density': 'executive',
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'variety.insights.json'), 'w') as f:
        json.dump({'schema': 'professional-slides.insights/v1', 'insights': INSIGHTS}, f, indent=1)
        f.write('\n')
    with open(os.path.join(OUT, 'variety.pages.json'), 'w') as f:
        json.dump({'deck': DECK, 'pages': PAGES}, f, indent=1)
        f.write('\n')
