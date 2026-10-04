"""Writes the evidence fixtures under evals/quality/fixtures/evidence/.

Four small decks on fictional subjects, none of them the benchmark's: a credit
union (finance, eight declared players), an ambulance service (public
operations, a closed evidence scope, a scenario and an analysis that cannot
run), a note-taking app (product strategy, three declared players) and an
explanation of a signalling upgrade (nothing compared, so no matrix is asked
for). Each page declares what its claim and exhibits rest on. Most exhibits
type their values beside a `basis`; the finance deck also writes numbers by
reference - a bound chart, a bound metric, and `{{...}}` tokens in a title and
in table cells - so both ways of putting a number on a page stay exercised.
Run from the repository root; the fixtures are committed, this script is how
they were made.
"""
import json
import os

OUT = 'evals/quality/fixtures/evidence'
FY = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26']
Q = ['2023 Q1', '2023 Q2', '2023 Q3', '2023 Q4', '2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4']
M = ['Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026']
SO = 'It bears directly on the decision the deck is for'


def ins(id, shape, finding, calc, measures=None, strength='strong', so=SO, cite=None, breadth=None):
    d = {'id': id, 'finding': finding, 'shape': shape, 'calculation': calc, 'sources': ['sources/%s.csv' % id], 'soWhat': so, 'strength': strength}
    if breadth:
        d['breadth'] = breadth
    if measures:
        d['measures'] = measures
    if cite:
        d['cite'] = cite
    return d


def series(unit, pop, vals, periods=FY, **k):
    return dict(unit=unit, population=pop, periods=periods, values=vals, **k)


def peers(unit, pop, period, members, vals, **k):
    return dict(unit=unit, population=pop, period=period, members=members, values=vals, **k)


def chart(heading, unit, cats, sers, basis, **k):
    return dict(heading=heading, unit=unit, categories=cats, series=[{'name': n, 'values': v} for n, v in sers], basis=basis, **k)


def bound(heading, sers, **k):
    """A chart that names its measures; the runtime writes its categories, values, unit and basis."""
    return dict(heading=heading, series=[{'measure': ref, 'name': n} for n, ref in sers], **k)


def write(name, deck, pages, insights, analyses, sources):
    os.makedirs(OUT, exist_ok=True)
    def dump(value, file):
        with open(f'{OUT}/{file}', 'w') as out:
            json.dump(value, out, indent=1)
            out.write('\n')
    dump({'deck': {'schema': 'professional-slides.deck/v3', **deck, 'design': 'consulting', 'density': 'executive'}, 'sources': sources, 'pages': pages}, f'{name}.pages.json')
    dump({'schema': 'professional-slides.insights/v1', 'insights': insights}, f'{name}.insights.json')
    if analyses is not None:
        dump({'schema': 'professional-slides.analysis/v1', 'analyses': analyses}, f'{name}.analysis.json')


# ---------------------------------------------------------------- finance
loans = [412, 438, 451, 476, 520, 566, 601, 648]
ocf = [58, 61, 49, 66, 72, 81, 84, 66]
pat = [31, 33, 22, 35, 39, 44, 47, 49]
liquid = [120, 131, 150, 162, 158, 171, 180, 196]
shortl = [96, 104, 118, 121, 139, 160, 172, 188]
cti = [71, 70, 74, 69, 67, 65, 63, 62]
branches = [42, 42, 41, 41, 40, 40, 40, 40]
P = ['Harbour', 'Northgate', 'Millrace', 'Castlefield', 'Dunmore', 'Eastbank', 'Ferrybridge', 'Greyfriars']
margin = [2.9, 3.4, 2.6, 3.1, 2.2, 2.8, 3.0, 2.4]
growth = [7.8, 5.1, 6.3, 4.4, 8.9, 3.9, 5.6, 6.0]
capital = [14.2, 16.8, 13.1, 15.5, 12.4, None, 15.0, 13.8]
HCU = 'Harbour Credit Union'
fin_ins = [
    ins('i-loans', 'series', 'Loans grew from 412 to 648 between FY19 and FY26', 'loan book at year end, FY19-FY26',
        {'loans': series('GBP m', HCU, loans)}, cite=['harbour-ar'], breadth={'periods': 8, 'series': 1}),
    ins('i-cash', 'series', 'Operating cash flow fell from 84 to 66 in FY26 after six years of growth', 'operating cash flow by year',
        {'ocf': series('GBP m', HCU, ocf)}, cite=['harbour-ar'], breadth={'periods': 8, 'series': 1}),
    ins('i-earn', 'series', 'Profit after tax rose every year since FY21', 'profit after tax by year',
        {'pat': series('GBP m', HCU, pat)}, cite=['harbour-ar'], breadth={'periods': 8, 'series': 1}),
    ins('i-liquidity', 'series', 'Liquid assets stay above short-term liabilities but the cushion narrows', 'liquid assets and liabilities due within a year, year end',
        {'liquid': series('GBP m', HCU, liquid), 'short-liabilities': series('GBP m', HCU, shortl)}, cite=['harbour-ar'], breadth={'periods': 8, 'series': 2}),
    ins('i-efficiency', 'series', 'Cost-to-income fell nine points with the branch network almost unchanged', 'operating cost over income; branches open at year end',
        {'cost-income': series('%', HCU, cti, better='down'), 'branches': series('branches', HCU, branches)}, cite=['harbour-ar'], breadth={'periods': 8, 'series': 2}),
    ins('i-peers', 'peer-set', 'Harbour is mid-table on margin and second on loan growth among eight credit unions', 'net interest margin, loan growth and capital ratio, latest year', {
        'margin': peers('%', 'regional credit unions', 'FY26', P, margin),
        'loan-growth': peers('% a year', 'regional credit unions', 'FY26', P, growth),
        'capital': peers('% of risk-weighted assets', 'regional credit unions', 'FY26', P, capital,
                         unavailable={'Eastbank': 'does not publish a capital ratio'}, boundaries={'Dunmore': 'calendar year, not fiscal'})},
        cite=['regulator-returns'], breadth={'members': 8}),
]
fin_an = [
    {'id': 'A-ocf', 'op': 'growth', 'inputs': ['i-cash/ocf'], 'from': 'FY25', 'to': 'FY26', 'soWhat': 'Cash generation fell while profit rose', 'strength': 'strong'},
    {'id': 'A-earn', 'op': 'growth', 'inputs': ['i-earn/pat'], 'from': 'FY25', 'to': 'FY26', 'soWhat': 'Profit growth continued through the cash decline', 'strength': 'supporting'},
    {'id': 'A-cushion', 'op': 'gap', 'inputs': ['i-liquidity/liquid', 'i-liquidity/short-liabilities'], 'soWhat': 'The liquidity cushion has narrowed to a third of its peak', 'strength': 'strong'},
    {'id': 'A-peers', 'op': 'compare', 'inputs': ['i-peers/margin', 'i-peers/loan-growth', 'i-peers/capital'], 'soWhat': 'No union leads on all three measures, so the ranking depends on priority', 'strength': 'strong'},
    {'id': 'A-floor', 'op': 'threshold', 'inputs': ['A-cushion/result'],
     'threshold': {'value': 0, 'unit': 'GBP m', 'rationale': 'liquid assets must cover liabilities due within a year'},
     'soWhat': 'Eight million of headroom remains above the cover floor', 'strength': 'supporting'},
    {'id': 'A-loans', 'op': 'growth', 'inputs': ['i-loans/loans'], 'soWhat': 'The book grew by more than half in seven years', 'strength': 'strong'},
    {'id': 'A-loans-year', 'op': 'growth', 'inputs': ['i-loans/loans'], 'from': 'FY25', 'to': 'FY26', 'soWhat': 'Lending grew faster in the latest year than profit did', 'strength': 'supporting'},
    {'id': 'A-liquid-year', 'op': 'growth', 'inputs': ['i-liquidity/liquid'], 'from': 'FY25', 'to': 'FY26', 'soWhat': 'Liquid assets rose in the latest year', 'strength': 'context'},
    {'id': 'A-index', 'op': 'index', 'inputs': ['i-loans/loans', 'i-liquidity/liquid', 'i-earn/pat', 'i-cash/ocf'],
     'soWhat': 'Lending and profit grew by more than half while cash flow ended barely above where it began', 'strength': 'supporting'},
    {'id': 'A-short-year', 'op': 'growth', 'inputs': ['i-liquidity/short-liabilities'], 'from': 'FY25', 'to': 'FY26',
     'soWhat': 'Liabilities due within a year rose by as much as liquid assets did', 'strength': 'context'},
]
fin_pages = [
    {'id': 'f0', 'type': 'summary', 'form': 'executive-summary', 'commentary': 'none', 'takeaway': False,
     'title': 'Harbour is growing faster than its peers on thinner liquidity',
     'why': 'The opening states the answer and the three findings behind it, each with what it means for the plan',
     'evidence': ['i-loans', 'i-cash', 'i-earn', 'i-liquidity', 'i-efficiency', 'i-peers', 'A-ocf', 'A-earn', 'A-cushion', 'A-peers', 'A-loans-year', 'A-liquid-year', 'A-short-year'],
     'settles': {'kind': 'comparison', 'what': 'growth, cash generation and liquidity cover against seven regional peers',
                 'measures': ['i-loans/loans', 'i-cash/ocf', 'i-earn/pat', 'i-efficiency/cost-income', 'i-liquidity/liquid', 'i-liquidity/short-liabilities', 'A-cushion/result', 'A-peers/margin']},
     'adds': 'Each point carries what its finding means for the plan, which the table does not show',
     'exhibit': {'type': 'table', 'treatment': 'dimensions', 'columns': ['Measure', 'FY25', 'FY26', 'Read'],
                 # The first six rows print their numbers by reference; the last two are typed, and traced.
                 'rows': [['Loan book', '{{i-loans/loans@FY25 | 0m}}', '{{i-loans/loans@FY26 | 0m}}', 'Up {{A-loans-year/percent | 0.0%}}'],
                          ['Profit after tax', '{{i-earn/pat@FY25 | 0m}}', '{{i-earn/pat@FY26 | 0m}}', 'Up {{A-earn/percent | 0.0%}}'],
                          ['Operating cash flow', '{{i-cash/ocf@FY25 | 0m}}', '{{i-cash/ocf@FY26 | 0m}}', 'Down {{A-ocf/percent | 0% | abs}}'],
                          ['Liquid assets', '{{i-liquidity/liquid@FY25 | 0m}}', '{{i-liquidity/liquid@FY26 | 0m}}', 'Up {{A-liquid-year/change | 0m}}'],
                          ['Short-term liabilities', '{{i-liquidity/short-liabilities@FY25 | 0m}}', '{{i-liquidity/short-liabilities@FY26 | 0m}}', 'Up {{A-short-year/change | 0m}}'],
                          ['Liquidity cushion', '{{A-cushion/result@FY25 | 0m}}', '{{A-cushion/result@FY26 | 0m}}', 'Peak 41m'],
                          ['Cost-to-income ratio', '63%', '62%', 'FY19 71%'],
                          ['Net interest margin', 'n/a', '2.9%', 'Fourth of eight']],
                 'basis': {'measures': ['i-loans/loans', 'i-cash/ocf', 'i-earn/pat', 'i-efficiency/cost-income', 'i-liquidity/liquid', 'i-liquidity/short-liabilities', 'A-cushion/result', 'A-peers/margin'], 'role': 'proof'}},
     'highlight': 'funding comes before further lending',
     'points': [
         'Lending is outrunning the funding behind it. Earnings no longer pay for the growth, so each new loan now draws on wholesale money or on the liquid assets that cover what falls due within a year.',
         'One more year at this pace, funded the same way, breaches the cover floor. The board therefore has to choose between slowing lending and raising term deposits before the next budget, and funding comes before further lending.',
         'The efficiency gain is real and did not come from shrinking the network, so there is no case for closures. Against its peers Harbour leads on growth, not on margin, which makes the price of new funding the number to protect.',
         'The peer comparison rests on one year of regulatory returns, and one union publishes no capital ratio, so the ranking is a guide to position rather than a forecast.']},
    {'id': 'f1', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'Loans grew {{A-loans/percent | 0%}} in seven years to {{i-loans/loans@FY26}} million',
     'why': 'The growth of the book over time is the claim, so the series is drawn', 'evidence': ['i-loans', 'A-loans'],
     'settles': {'kind': 'rate', 'what': 'loan book at year end FY19 to FY26', 'measures': ['i-loans/loans']},
     'exhibit': chart('Loan book at year end', 'GBP m', FY, [('Loans', loans)], {'measures': ['i-loans/loans'], 'role': 'proof'}, highlights=[{'category': 'FY26'}]),
     'bar': 'A loan book this much larger needs deposits, wholesale funding and regulatory capital that have grown at the same pace, which the next pages test'},
    {'id': 'f2', 'type': 'numbers', 'form': 'metric-strip', 'commentary': 'none', 'title': 'Profit rose again while operating cash flow fell 21%',
     'why': 'Two year-on-year movements set against the cash series that produced one of them', 'evidence': ['i-cash', 'i-earn', 'A-ocf', 'A-earn'],
     'settles': {'kind': 'comparison', 'what': 'profit after tax and operating cash flow, FY25 to FY26', 'measures': ['i-cash/ocf', 'i-earn/pat']},
     'metrics': [{'value': '+4.3%', 'label': 'Profit after tax', 'sublabel': '47 to 49', 'basis': {'measures': ['A-earn/percent']}},
                 {'measure': 'A-ocf/percent', 'format': '+0.0%', 'label': 'Operating cash flow', 'sublabel': '84 to 66'}],
     'exhibit': chart('Operating cash flow', 'GBP m', FY, [('Operating cash flow', ocf)], {'measures': ['i-cash/ocf'], 'role': 'proof'}, type='chart.column', highlights=[{'category': 'FY26'}],
                      caption='Operating cash flow fell to 66 million in FY26, the first decline in five years, while profit after tax rose to 49 million: growth in lending absorbed the cash that earnings produced')},
    {'id': 'f3', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'The liquidity cushion narrowed from 41 million to 8 million',
     'why': 'The gap between two series in one unit is the claim, so both are drawn on one scale', 'evidence': ['i-liquidity', 'A-cushion', 'A-floor'],
     'settles': {'kind': 'comparison', 'what': 'liquid assets and short-term liabilities at year end',
                 'measures': ['i-liquidity/liquid', 'i-liquidity/short-liabilities'], 'relation': {'kind': 'gap'}},
     'exhibit': bound('Liquid assets and liabilities due within a year', [('Liquid assets', 'i-liquidity/liquid'), ('Short-term liabilities', 'i-liquidity/short-liabilities')],
                      role='proof', highlights=[{'category': 'FY26'}]),
     'bar': 'Another year of lending at this pace, funded the same way, would take liquid assets below the liabilities that fall due within a year'},
    {'id': 'f4', 'type': 'panels', 'form': 'row', 'commentary': 'captions', 'title': 'Costs fell nine points without closing branches',
     'why': 'A ratio and a count in different units, each read on its own panel', 'evidence': ['i-efficiency'],
     'settles': {'kind': 'comparison', 'what': 'cost-to-income and branches open', 'measures': ['i-efficiency/cost-income']},
     'adds': 'The captions say the efficiency gain did not come from shrinking the network',
     'exhibits': [
         chart('Cost-to-income ratio', '%', FY, [('Cost-to-income', cti)], {'measures': ['i-efficiency/cost-income'], 'role': 'proof'}, type='chart.line',
               highlights=[{'category': 'FY26'}], caption='The ratio fell from 71 to 62 percent over seven years of rising income'),
         chart('Branches open at year end', 'branches', FY, [('Branches', branches)],
               {'measures': ['i-efficiency/branches'], 'role': 'context', 'relevance': 'It rules out branch closures as the source of the cost saving'},
               type='chart.column', caption='The network lost two branches in seven years, far too few to explain the saving')]},
    {'id': 'f5', 'type': 'ranking', 'form': 'bar', 'commentary': 'so-what-bar', 'title': 'Harbour ranks fourth of eight on net interest margin',
     'why': 'The whole peer set on one measure, with the subject marked', 'evidence': ['i-peers', 'A-peers'],
     'settles': {'kind': 'rank', 'what': 'net interest margin across eight credit unions, FY26', 'measures': ['A-peers/margin']},
     'exhibit': dict(heading='Net interest margin, FY26', unit='%',
                     categories=['Northgate', 'Castlefield', 'Ferrybridge', 'Harbour', 'Eastbank', 'Millrace', 'Greyfriars', 'Dunmore'],
                     series=[{'name': 'Margin', 'values': [3.4, 3.1, 3.0, 2.9, 2.8, 2.6, 2.4, 2.2]}], highlights=[{'category': 'Harbour'}],
                     basis={'measures': ['A-peers/margin'], 'role': 'proof'}),
     'bar': 'Loan growth, not margin, is where Harbour leads its seven regional peers, so the plan protects the cost of funding before it adds lending'},
    # An indexed trend from references alone: the series are an index analysis's measures, and the base comes with them.
    {'id': 'f6', 'type': 'trend', 'form': 'indexed', 'commentary': 'so-what-bar', 'title': 'Cash flow alone has not kept pace with lending',
     'why': 'Four measures in one unit but of very different size, compared on growth since FY19, so each is rebased to 100', 'evidence': ['A-index'],
     'settles': {'kind': 'rate', 'what': 'loans, liquid assets, profit and operating cash flow, FY19 to FY26, each indexed to FY19',
                 'measures': ['A-index/loans', 'A-index/liquid', 'A-index/pat', 'A-index/ocf'], 'relation': {'kind': 'index'}},
     'exhibit': bound('Growth since FY19', [('Loans', 'A-index/loans'), ('Liquid assets', 'A-index/liquid'), ('Profit after tax', 'A-index/pat'), ('Operating cash flow', 'A-index/ocf')],
                      subject='Operating cash flow'),
     'bar': 'Earnings and liquid assets have grown with the loan book; the cash the business generates has not, which is why the growth now draws on liquidity'},
]
write('finance', {'id': 'finance', 'workflow': 'new_deck',
                  'request': 'Is Harbour Credit Union growing safely, and how does it compare with its regional peers?',
                  'brief': 'Is Harbour Credit Union growing safely against its regional peers?',
                  'answer': 'Harbour is growing faster than its peers on thinner liquidity, so funding comes before further lending.', 'players': P},
      fin_pages, fin_ins, fin_an,
      {'harbour-ar': {'name': 'Harbour Credit Union annual report 2026', 'status': 'illustrative'},
       'regulator-returns': {'name': 'Regional regulator annual returns 2026', 'status': 'illustrative'}})

# ---------------------------------------------------------------- public operations: one service, a closed evidence scope
resp = [8.9, 9.4, 9.8, 10.6, 10.1, 10.9, 11.4, 12.2]
calls = [41.2, 42.0, 43.1, 45.6, 44.8, 46.0, 47.3, 49.9]
crews = [118, 118, 117, 116, 116, 115, 114, 114]
handover = [21, 24, 26, 33, 30, 35, 38, 44]
per_crew = [round(c / k, 6) for c, k in zip(calls, crews)]
D = ['North', 'Central', 'Harbourside', 'East', 'Valley', 'Uplands', 'South', 'Riverbend']
dresp = [9.8, 13.9, 12.6, 11.2, 14.8, 16.1, 10.4, 12.0]
RAS = 'Riverside ambulance service'
HORIZON = ['2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4', '2027 Q1', '2027 Q2', '2027 Q3', '2027 Q4']
pub_ins = [
    ins('o-response', 'series', 'Mean response time rose from 8.9 to 12.2 minutes in two years', 'mean category-two response time by quarter',
        {'response': series('minutes', RAS, resp, Q, better='down')}, cite=['ras-board'], breadth={'periods': 8, 'series': 1}),
    ins('o-demand', 'series', 'Calls rose 21% while crews on shift fell 3%', 'calls answered and crews on shift by quarter',
        {'calls': series('thousand calls', RAS, calls, Q), 'crews': series('crews on shift', RAS, crews, Q)}, cite=['ras-board'], breadth={'periods': 8, 'series': 2}),
    ins('o-handover', 'series', 'Hospital handover delay doubled to 44 minutes', 'mean handover time at emergency departments by quarter',
        {'handover': series('minutes', RAS, handover, Q, better='down')}, cite=['ras-board'], breadth={'periods': 8, 'series': 1}),
    ins('o-districts', 'peer-set', 'Response time ranges from 9.8 to 16.1 minutes across eight districts', 'mean response time by district, latest quarter',
        {'response': peers('minutes', 'Riverside districts', '2024 Q4', D, dresp, better='down')}, cite=['ras-board'], breadth={'members': 8}),
    ins('o-standard', 'fact', 'The national standard for a category-two response is 18 minutes', 'published standard',
        {'standard': dict(unit='minutes', population='national standard', period='2024', value=18)}, strength='context', cite=['national-standard']),
    ins('o-mechanism', 'qualitative', 'Crews held at hospital doors cannot answer the next call', 'interviews with dispatch and crew leads', strength='supporting'),
]
pub_an = [
    {'id': 'B-per-crew', 'op': 'ratio', 'inputs': ['o-demand/calls', 'o-demand/crews'], 'soWhat': 'Each crew now answers a quarter more calls than two years ago', 'strength': 'strong'},
    {'id': 'B-headroom', 'op': 'threshold', 'inputs': ['o-response/response'], 'threshold': {'ref': 'o-standard/standard'}, 'safe': 'below',
     'soWhat': 'Under six minutes of headroom to the national standard remains', 'strength': 'strong'},
    {'id': 'B-path', 'op': 'scenario', 'inputs': ['o-response/response'], 'method': 'linear',
     'assumptions': [{'name': 'quarterly rise', 'value': 0.5, 'unit': 'minutes', 'rationale': 'the mean quarterly rise over the last eight quarters continues'}],
     'horizon': HORIZON, 'threshold': {'ref': 'o-standard/standard'},
     'soWhat': 'On the recent trend the service breaches the standard within three years', 'strength': 'supporting'},
    {'id': 'B-districts', 'op': 'rank', 'inputs': ['o-districts/response'], 'soWhat': 'Uplands and Valley are furthest from the standard and take the first crews', 'strength': 'strong'},
    {'id': 'B-rise', 'op': 'growth', 'inputs': ['o-response/response'], 'soWhat': 'Response time rose by more than a third in two years', 'strength': 'strong'},
    {'id': 'B-vehicles', 'op': 'gap', 'inputs': ['o-demand/crews', 'o-fleet/vehicles'], 'missing': ['vehicles available by quarter: the fleet register was not supplied'],
     'soWhat': 'Whether vehicles or crews bind cannot be settled without the fleet register', 'strength': 'context'},
]
pub_pages = [
    {'id': 'o1', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'Response time rose 37% in two years to 12.2 minutes',
     'why': 'The rise over time is the claim, so the quarterly series is drawn', 'evidence': ['o-response', 'B-headroom', 'B-path', 'B-rise'],
     'settles': {'kind': 'rate', 'what': 'mean response time by quarter', 'measures': ['o-response/response']},
     'exhibit': chart('Mean category-two response time', 'minutes', Q, [('Response time', resp)], {'measures': ['o-response/response']}, highlights=[{'category': '2024 Q4'}]),
     'bar': 'At this rate the service loses the headroom it has to the national standard'},
    {'id': 'o2', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'Each crew answers a quarter more calls than in 2023',
     'why': 'A ratio the runtime computed from two records, drawn over time', 'evidence': ['o-demand', 'B-per-crew'],
     'settles': {'kind': 'rate', 'what': 'calls answered per crew on shift by quarter', 'measures': ['o-demand/calls', 'o-demand/crews'], 'relation': {'kind': 'ratio'}},
     'exhibit': chart('Calls answered per crew on shift', 'thousand calls per crews on shift', Q, [('Calls per crew', per_crew)], {'measures': ['B-per-crew/result']},
                      highlights=[{'category': '2024 Q4'}]),
     'bar': 'Demand per crew, not crew numbers alone, is what the roster has to answer'},
    {'id': 'o3', 'type': 'panels', 'form': 'row', 'commentary': 'captions', 'title': 'Handover delay doubled as response time rose',
     'why': 'Two delays in one unit, each with its own cause, read on its own panel', 'evidence': ['o-handover', 'o-response'],
     'settles': {'kind': 'comparison', 'what': 'handover and response time by quarter', 'measures': ['o-handover/handover', 'o-response/response'],
                 'relation': {'kind': 'separate', 'reason': 'Handover and response are different stages of a call and are not subtracted from each other'}},
     'adds': 'The captions separate time lost at the hospital door from time lost on the road',
     'exhibits': [
         chart('Mean hospital handover time', 'minutes', Q, [('Handover', handover)], {'measures': ['o-handover/handover']}, type='chart.column',
               highlights=[{'category': '2024 Q4'}], caption='Crews now wait 44 minutes at the door, more than double the 2023 figure'),
         chart('Mean response time', 'minutes', Q, [('Response', resp)], {'measures': ['o-response/response']}, type='chart.line',
               highlights=[{'category': '2024 Q4'}], caption='Response time rose more slowly, by just over three minutes across the same quarters')]},
    {'id': 'o4', 'type': 'ranking', 'form': 'bar', 'commentary': 'so-what-bar', 'title': 'Uplands and Valley are slowest of eight districts',
     'why': 'The whole set of districts on one measure, ordered', 'evidence': ['o-districts', 'B-districts'],
     'settles': {'kind': 'rank', 'what': 'mean response time by district, 2024 Q4', 'measures': ['B-districts/value']},
     'exhibit': dict(heading='Mean response time by district, 2024 Q4', unit='minutes', categories=['North', 'South', 'East', 'Riverbend', 'Harbourside', 'Central', 'Valley', 'Uplands'],
                     series=[{'name': 'Response', 'values': [9.8, 10.4, 11.2, 12.0, 12.6, 13.9, 14.8, 16.1]}], highlights=[{'category': 'Uplands'}],
                     basis={'measures': ['B-districts/value']}),
     'bar': 'The first additional crews go to the two districts furthest from the standard'},
    {'id': 'o5', 'type': 'mechanism', 'form': 'process', 'commentary': 'so-what-bar', 'title': 'A crew held at hospital cannot answer the next call',
     'why': 'The chain from handover delay to response time is a mechanism, drawn as steps', 'evidence': ['o-mechanism'],
     'settles': {'kind': 'structure', 'what': 'how handover delay becomes response delay'},
     'exhibit': {'items': [{'label': 'Crew arrives at hospital'}, {'label': 'Handover waits for a bay'}, {'label': 'Crew unavailable to dispatch'}, {'label': 'Next call waits longer'}]},
     'bar': 'Releasing crews at the door returns capacity faster than hiring does'},
    # A recorded series and then a scenario's path, drawn as one line from references: the runtime brackets the assumed run.
    {'id': 'o6', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'On the recent trend the standard is breached within three years',
     'why': 'The recorded quarters and the assumed path are one line, so the reader sees where the assumption begins and where it crosses the standard',
     'evidence': ['o-response', 'B-path', 'o-standard'],
     'settles': {'kind': 'rate', 'what': 'mean response time by quarter, recorded and then carried forward at the recent quarterly rise', 'measures': ['o-response/response', 'B-path/path']},
     'exhibit': bound('Mean category-two response time, recorded and assumed', [('Response time', ['o-response/response', 'B-path/path']), ('National standard', 'o-standard/standard')],
                      select={'from': '2024 Q1'}),
     'bar': 'The path is an assumption, not a forecast: it says how long the service has if nothing changes'},
]
write('public-ops', {'id': 'public-ops', 'workflow': 'new_deck',
                     'request': 'Why are ambulance response times rising, and where should the first new crews go? Use only the board papers we have sent you.',
                     'answer': 'Demand per crew and hospital handover drive the rise; Uplands and Valley take the first crews.',
                     'evidenceScope': {'retrieval': 'closed', 'note': 'only the board papers supplied by the service may be used', 'quote': 'Use only the board papers we have sent you'}},
      pub_pages, pub_ins, pub_an,
      {'ras-board': {'name': 'Riverside ambulance service board papers, 2023-2024', 'status': 'illustrative'},
       'national-standard': {'name': 'National response standards 2024', 'status': 'illustrative'}})

# ---------------------------------------------------------------- product strategy: three declared players
ret = [100, 62, 51, 45, 41, 39, 38, 37]
retold = [100, 55, 41, 33, 28, 25, 23, 22]
feat = ['Capture', 'Search', 'Sharing', 'Templates']
use = [46, 27, 18, 9]
PL = ['Lumen', 'Quill', 'Paperly']
paying = [3.1, 3.9, 4.8, 5.9, 7.2, 8.4, 9.9, 11.6]
active = [78, 86, 95, 102, 110, 117, 124, 129]
paid_share = [round(100 * p / a, 6) for p, a in zip(paying, active)]
pr_ins = [
    ins('p-retention', 'series', 'Users given the new onboarding are 37% retained by March against 22% on the old one', 'share of the August signups still active each month, by onboarding version',
        {'new-onboarding': series('% of cohort', 'Lumen August signups, new onboarding', ret, M), 'old-onboarding': series('% of cohort', 'Lumen August signups, old onboarding', retold, M)},
        cite=['lumen-analytics'], breadth={'periods': 8, 'series': 2}),
    ins('p-usage', 'mix', 'Capture and search are 73% of sessions', 'sessions by first feature used',
        {'sessions': peers('% of sessions', 'Lumen sessions', 'March 2026', feat, use)}, cite=['lumen-analytics'], breadth={'parts': 4}),
    ins('p-rivals', 'fact', 'Lumen leads on retention and trails on price and integrations', 'month-eight retention, monthly price and integrations for three products', {
        'retention': peers('% of cohort', 'note-taking apps', 'March 2026', PL, [37, 31, None], unavailable={'Paperly': 'publishes no retention figure'}),
        'price': peers('USD a month', 'note-taking apps', 'March 2026', PL, [12, 8, 10], better='down'),
        'integrations': peers('integrations', 'note-taking apps', 'March 2026', PL, [14, 41, 26])},
        cite=['public-pricing'], so='Retention is the one lead Lumen can defend'),
    ins('p-paid', 'series', 'Paying users rose from 4% to 9% of actives in eight months', 'paying and active users by month',
        {'paying': series('thousand users', 'Lumen', paying, M), 'active': series('thousand users', 'Lumen', active, M)},
        cite=['lumen-analytics'], breadth={'periods': 8, 'series': 2}),
]
pr_an = [
    {'id': 'C-rivals', 'op': 'compare', 'inputs': ['p-rivals/retention', 'p-rivals/price', 'p-rivals/integrations'],
     'soWhat': 'Lumen leads on one of three measures, so the strategy rests on retention', 'strength': 'strong'},
    {'id': 'C-lift', 'op': 'gap', 'inputs': ['p-retention/new-onboarding', 'p-retention/old-onboarding'], 'soWhat': 'The retention lift widens every month after signup', 'strength': 'strong'},
    {'id': 'C-paid', 'op': 'ratio', 'inputs': ['p-paid/paying', 'p-paid/active'], 'percent': True, 'soWhat': 'Conversion to paid has more than doubled', 'strength': 'strong'},
    {'id': 'C-mix', 'op': 'share', 'inputs': ['p-usage/sessions'], 'soWhat': 'Two features carry three quarters of use', 'strength': 'supporting'},
]
pr_pages = [
    {'id': 'p1', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'The new onboarding retains 15 points more by March',
     'why': 'Two cohorts in one unit on one scale, so the gap is read off the chart', 'evidence': ['p-retention', 'C-lift'],
     'settles': {'kind': 'comparison', 'what': 'share of the August cohort active each month, by onboarding version',
                 'measures': ['p-retention/new-onboarding', 'p-retention/old-onboarding'], 'relation': {'kind': 'gap'}},
     'exhibit': chart('Share of August signups still active', '% of cohort', M, [('New onboarding', ret), ('Old onboarding', retold)],
                      {'measures': ['p-retention/new-onboarding', 'p-retention/old-onboarding']}, highlights=[{'category': 'Mar 2026'}]),
     'bar': 'Retention is where the product changed, so the plan invests there first'},
    {'id': 'p2', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'Paying users doubled as a share of actives',
     'why': 'The ratio of two records, computed and drawn over time', 'evidence': ['p-paid', 'C-paid'],
     'settles': {'kind': 'rate', 'what': 'paying users as a share of active users by month', 'measures': ['C-paid/result']},
     'exhibit': chart('Paying users as a share of active users', '%', M, [('Paid share', paid_share)], {'measures': ['C-paid/result']}, highlights=[{'category': 'Mar 2026'}]),
     'bar': 'Conversion, not signups, is now the faster route to revenue'},
    {'id': 'p3', 'type': 'scorecard', 'form': 'heatmap', 'commentary': 'so-what-bar', 'title': 'Lumen leads on retention and trails on price and integrations',
     'why': 'Three products on three common measures, the undisclosed cell kept as n/a', 'evidence': ['p-rivals', 'C-rivals'],
     'settles': {'kind': 'comparison', 'what': 'retention, price and integrations for three products',
                 'measures': ['C-rivals/retention', 'C-rivals/price', 'C-rivals/integrations']},
     'exhibit': {'columns': [{'label': 'Product', 'type': 'category'}, {'label': 'Month-eight retention, %', 'heat': True}, {'label': 'Price, USD a month', 'heat': True},
                             {'label': 'Integrations', 'heat': True}],
                 'rows': [['Lumen', 37, 12, 14], ['Quill', 31, 8, 41], ['Paperly', 'n/a', 10, 26]],
                 'basis': {'measures': ['C-rivals/retention', 'C-rivals/price', 'C-rivals/integrations']}},
     'bar': 'The lead is real on one measure only, so the strategy defends retention'},
    {'id': 'p4', 'type': 'composition', 'form': 'donut', 'commentary': 'so-what-bar', 'title': 'Capture is 46% of sessions and search another 27%',
     'why': 'The parts of one whole, four of them', 'evidence': ['p-usage', 'C-mix'],
     'settles': {'kind': 'share', 'what': 'sessions by first feature used, March 2026', 'measures': ['p-usage/sessions']},
     'exhibit': {'labels': feat, 'values': use, 'unit': '% of sessions', 'heading': 'Sessions by first feature used, March 2026', 'basis': {'measures': ['p-usage/sessions']}},
     'bar': 'Sharing and templates are where a second habit would have to be built'},
]
write('product', {'id': 'product', 'workflow': 'new_deck', 'request': 'Where should Lumen invest next to hold its lead over Quill and Paperly?',
                  'answer': 'Lumen leads only on retention, so it invests there and in conversion rather than matching integrations.', 'players': PL},
      pr_pages, pr_ins, pr_an,
      {'lumen-analytics': {'name': 'Lumen product analytics, March 2026', 'status': 'illustrative'},
       'public-pricing': {'name': 'Published pricing and integration pages, March 2026', 'status': 'illustrative'}})

# ---------------------------------------------------------------- an explanation: nothing is compared, so no matrix is asked for
faults = [61, 58, 49, 44, 31, 26, 22, 19]
ex_ins = [
    ins('x-faults', 'series', 'Signal faults fell from 61 to 19 a quarter on the converted section', 'signal faults by quarter on the converted section',
        {'faults': series('faults a quarter', 'Line 2, converted section', faults, Q, better='down')}, cite=['tram-ops'], breadth={'periods': 8, 'series': 1}),
    ins('x-how', 'qualitative', 'The new system moves the block boundary with the tram rather than fixing it to the track', 'engineering description'),
    ins('x-plan', 'schedule', 'Conversion runs section by section over three years', 'programme plan', strength='supporting'),
]
ex_pages = [
    {'id': 'x1', 'type': 'mechanism', 'form': 'process', 'commentary': 'so-what-bar', 'title': 'Moving blocks let trams follow each other more closely',
     'why': 'How the system works is a sequence, drawn as steps', 'evidence': ['x-how'], 'settles': {'kind': 'structure', 'what': 'how a moving block replaces a fixed one'},
     'exhibit': {'items': [{'label': 'Tram reports its position'}, {'label': 'Control computes safe distance'}, {'label': 'Following tram gets its limit'}, {'label': 'Boundary moves with the tram'}]},
     'bar': 'Capacity rises without new track because the gap between trams shrinks'},
    {'id': 'x2', 'type': 'trend', 'form': 'line', 'commentary': 'so-what-bar', 'title': 'Faults on the converted section fell by two thirds',
     'why': 'The fall over time is the claim, so the quarterly series is drawn', 'evidence': ['x-faults'],
     'settles': {'kind': 'rate', 'what': 'signal faults by quarter', 'measures': ['x-faults/faults']},
     'exhibit': chart('Signal faults on the converted section', 'faults a quarter', Q, [('Faults', faults)], {'measures': ['x-faults/faults']}, highlights=[{'category': '2024 Q4'}]),
     'bar': 'Reliability, not only capacity, is what the first section has already delivered'},
    {'id': 'x3', 'type': 'schedule', 'form': 'roadmap', 'commentary': 'none', 'title': 'Conversion reaches the whole line in three years',
     'why': 'Dated phases of one programme, in order', 'evidence': ['x-plan'], 'settles': {'kind': 'sequence', 'what': 'the phases of the conversion programme'},
     'exhibit': {'items': [{'label': 'Section A', 'period': '2024', 'detail': 'Converted and in service'}, {'label': 'Section B', 'period': '2025', 'detail': 'Trackside equipment installed'},
                           {'label': 'Section C', 'period': '2026', 'detail': 'Fleet fitted with new units'}, {'label': 'Whole line', 'period': '2027', 'detail': 'Fixed blocks withdrawn'}]}},
]
write('explainer', {'id': 'explainer', 'workflow': 'new_deck', 'request': 'Explain how the tram signalling upgrade works and what it has delivered so far.',
                    'answer': 'Moving blocks shorten the gap between trams, and the first section already shows two thirds fewer faults.'},
      ex_pages, ex_ins, None, {'tram-ops': {'name': 'Tram operations fault log, 2023-2024', 'status': 'illustrative'}})
print('written', sorted(os.listdir(OUT)))
