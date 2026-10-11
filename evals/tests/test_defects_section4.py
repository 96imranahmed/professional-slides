"""Defects a probe of the catalogue found, each held where it was fixed.

A funnel that said it drew conversion rates and drew none; a heat key printed
once per column over columns that share one scale; a bar chart's deltas
heading set across its legend; a radar held under its points; an agenda in
columns floating between two empty bands; a median cut away beside labels it
never touched; a cover rule drawn in the cover's own colour; a phase roadmap
and the dated schedules asked for the `items` only the strip draws; a decision
tree refused without an overall conclusion its title already stated; three
two-state codes the grading described as one job; a photo backdrop that set
its chart beside a picture rather than over a photograph; table archetypes
an author could name but whose row style the composer dropped; a seven-point
curve refused as thinner than seven bars; `percent` ignored on a stacked area
and anywhere else nothing stacks; a measure table whose heat columns took a
total row it could not draw, summed from the shading steps.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { TOKENS, THEME_SLOT_TOKENS, tokenValue } from './skills/professional-slides/runtime/core.mjs';
import { resolvePalette, PALETTES } from './skills/professional-slides/runtime/palettes.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
import { contrastRatio } from './skills/professional-slides/runtime/color.mjs';
import { measureDataLabel } from './skills/professional-slides/runtime/chart-decorations.mjs';
import { compilePage, placementsOf } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
"""


class DefectTests(unittest.TestCase):
    def test_a_funnel_draws_what_each_stage_kept(self):
        run_node(PRELUDE + """
const funnel = REGISTRY.get('funnel');
const stages = [{ label: 'Market', value: 100 }, { label: 'Qualified', value: 62 }, { label: 'Engaged', value: 38 }, { label: 'Won', value: 18 }];
const rates = (props) => funnel.render({ id: 'f', frame: { x: 0, y: 0, width: 700, height: 360 }, props: { stages, ...props } }).nodes.filter((n) => n.role === 'funnel-rate').map((n) => n.text);
assert.deepEqual(rates({}), ['62% of market', '61% of qualified', '47% of engaged']);
assert.deepEqual(rates({ rates: 'first' }), ['62% of market', '38% of market', '18% of market']);
assert.deepEqual(rates({ rates: 'none' }), []);
assert.match(error(() => rates({ rates: 'all' })), /Funnel rates are/);
console.log('{}');
""")

    def test_columns_on_one_domain_share_one_heat_key(self):
        run_node(PRELUDE + """
const page = { id: 'h', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'The reader looks up a station on three measures on one scale',
  settles: { kind: 'comparison', what: 'satisfaction on three attributes at four stations' }, title: 'Coast stations trail the network on every satisfaction measure',
  exhibit: { columns: ['Station', { label: 'Punctuality, % satisfied', heat: true, domain: [0, 100] }, { label: 'Cleanliness, % satisfied', heat: true, domain: [0, 100] }, { label: 'Information, % satisfied', heat: true, domain: [0, 100] }],
    rows: [['Keighley', '82', '74', '69'], ['Halifax', '75', '66', '64'], ['Selby', '64', '58', '55'], ['Malton', '55', '50', '44']] } };
const [slide] = composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, '.').deck.slides;
const keys = slide.nodes.filter((n) => n.id.includes(':legend-ramp:'));
assert.equal(keys.length, 1, 'one key for the three columns');
assert.deepEqual(slide.nodes.filter((n) => n.role === 'table-legend').map((n) => n.text), ['0', '100']);
console.log('{}');
""")

    def test_a_bar_charts_deltas_heading_clears_its_legend(self):
        run_node(PRELUDE + """
const nodes = REGISTRY.get('chart.stacked-bar').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 420 }, props: {
  categories: ['City', 'Valley', 'Eastern', 'Dales', 'Coast'], series: [{ name: 'Commuting', values: [52, 44, 41, 27, 21] }, { name: 'Leisure', values: [26, 31, 30, 52, 58] }, { name: 'Education', values: [14, 16, 18, 12, 11] }, { name: 'Business', values: [8, 9, 11, 9, 10] }],
  deltas: [6, -3, 2, -4, 1] } }).nodes;
const heading = nodes.find((n) => n.data?.deltasHeading);
for (const label of nodes.filter((n) => n.role === 'legend-label')) assert.ok(!overlaps(heading.frame, label.frame), `the heading clears ${label.text}`);
console.log('{}');
""")

    def test_a_radar_sits_beside_its_points(self):
        run_node(PRELUDE + """
assert.deepEqual(placementsOf('profiles', 'radar'), ['beside', 'beside-left', 'rail', 'below', 'none']);
const page = { id: 'r', type: 'profiles', form: 'radar', commentary: 'beside', takeaway: false, why: 'The shape of the profile against the best peer is the comparison',
  settles: { kind: 'comparison', what: 'ratings on six attributes for two operators' }, adds: 'The points say which gaps the plan closes',
  title: 'Northvale matches the best peer on reliability, not on frequency',
  exhibit: { heading: 'Passenger ratings', categories: ['Reliability', 'Frequency', 'Journey time', 'Fares', 'Stations', 'Information'], series: [{ name: 'Northvale', values: [4.2, 2.1, 3.6, 3.0, 3.8, 4.0] }, { name: 'Westmoor', values: [4.4, 4.4, 3.9, 3.9, 3.9, 4.1] }], max: 5, focusSeries: 'Northvale' },
  points: [{ lead: 'Frequency is the gap', text: 'Off-peak frequency scores 2.1 against 4.4, the widest gap of the six.' }, { lead: 'Fares follow', text: 'The fares gap closes with reform in 2030, after the timetable.' }] };
const [slide] = composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, '.').deck.slides;
const marks = slide.nodes.filter((n) => n.id.includes('exhibit') && n.role !== 'section-heading');
const points = slide.nodes.filter((n) => n.id.includes('points'));
const right = Math.max(...marks.map((n) => n.frame.x + n.frame.width)), left = Math.min(...points.map((n) => n.frame.x));
assert.ok(right <= left + 1, 'the radar stands beside its points, not over them');
console.log('{}');
""")

    def test_the_agenda_columns_run_the_bodys_height(self):
        run_node(PRELUDE + """
const nodes = REGISTRY.get('agenda').render({ id: 'a', frame: { x: 60, y: 140, width: 1160, height: 520 }, props: { variant: 'columns', active: 1, items: [{ label: 'Where ridership stands' }, { label: 'What passengers want' }, { label: 'How the plan wins them back' }] } }).nodes;
const band = nodes.find((n) => n.role === 'agenda-band');
assert.equal(band.frame.y, 140);
assert.equal(band.frame.height, 520, 'the active section is a band the body\\'s height');
console.log('{}');
""")

    def test_a_median_through_bar_labels_breaks_only_at_their_ink(self):
        run_node(PRELUDE + """
const names = Array.from({ length: 12 }, (_, i) => `Operator ${i + 1}`), values = names.map((_, i) => 12 + i * 0.7);
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 0, y: 0, width: 760, height: 460 }, props: { categories: names, series: [{ name: 'Cost', values }], referenceLines: [{ value: 17.9, label: 'Median 17.9' }] } }).nodes;
const segments = nodes.filter((n) => n.role === 'chart-reference-line'), x = segments[0].frame.x;
const crossed = (label) => segments.some((n) => n.frame.y <= label.frame.y && n.frame.y + n.frame.height >= label.frame.y + label.frame.height);
const clear = nodes.filter((n) => n.role === 'data-label' && n.frame.x + measureDataLabel(n.text).width + 4 < x && n.frame.x + n.frame.width > x);
assert.ok(clear.length > 0, 'a label slot reaches the line past its figure');
for (const label of clear) assert.ok(crossed(label), `the line runs on past ${label.text}`);
console.log('{}');
""")

    def test_every_cover_rule_reads_on_its_cover(self):
        run_node(PRELUDE + """
const cover = REGISTRY.get('cover');
for (const name of Object.keys(PALETTES)) for (const tone of ['dark', 'light']) {
  const { tokens } = resolvePalette(name, TOKENS, THEME_SLOT_TOKENS);
  withDesignTokens(tokens, () => {
    const nodes = cover.render({ id: 'c', frame: { x: 0, y: 0, width: 1280, height: 720 }, props: { title: 'Northvale Rail growth plan', tone, ...(tone === 'light' ? { variant: 'plain' } : {}) } }).nodes;
    const rule = nodes.find((n) => n.role === 'cover-accent');
    const surface = tone === 'dark' ? tokenValue({ tokenId: 'color.ink' }) : tokenValue({ tokenId: 'color.canvas' });
    const ratio = contrastRatio(tokenValue(rule.style.stroke), surface);
    assert.ok(ratio >= 3, `${name} ${tone}: the rule reads at ${ratio.toFixed(2)}:1`);
  });
}
console.log('{}');
""")

    def test_a_schedule_variant_is_counted_in_its_own_parts(self):
        run_node(PRELUDE + """
const page = (form, exhibit) => ({ id: 's', type: 'schedule', form, commentary: 'none', takeaway: false, why: 'The board approves the order of the work',
  settles: { kind: 'sequence', what: 'the phases of the timetable recast' }, title: 'The recast runs in two phases, design first and shadow running from May', exhibit });
const phase = (id, n) => ({ id, label: `Phase ${id}`, workstreams: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, label: `Workstream ${i + 1}`, activities: [{ id: `${id}-${i}-a`, text: 'Model demand on the eight corridors.' }] })) });
assert.ok(compilePage(page('roadmap', { variant: 'phase-workstreams', phases: [phase('a', 2), phase('b', 2)] })));
assert.match(error(() => compilePage(page('roadmap', { variant: 'phase-workstreams', phases: [phase('a', 1), phase('b', 1)] }))), /four or more workstreams/);
const plan = REGISTRY.get('roadmap').render({ id: 'r', frame: { x: 0, y: 0, width: 1160, height: 480 }, props: { variant: 'phase-workstreams', phases: [phase('a', 2), phase('b', 2)] } }).nodes;
assert.ok(!plan.some((n) => n.role === 'roadmap-products-label'), 'no products, no products heading');
const axis = { kind: 'periods', precision: 'week', periods: ['w1', 'w2', 'w3', 'w4'].map((id) => ({ id, label: id.toUpperCase() })) };
const lanes = (n) => [{ id: 'spec', label: 'Specification', events: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, periodId: `w${i + 1}`, kind: 'meeting' })) }];
const grid = (n) => page('timeline', { variant: 'time-grid', axis, lanes: lanes(n), eventKinds: [{ id: 'meeting', label: 'Review', symbol: 'triangle' }] });
assert.ok(compilePage(grid(4)));
assert.match(error(() => compilePage(grid(2))), /four or more events in its lanes/);
assert.doesNotMatch(error(() => compilePage(grid(2))), /reads `items`/);
console.log('{}');
""")

    def test_a_decision_tree_may_end_at_its_leaves(self):
        run_node(PRELUDE + """
const tree = REGISTRY.get('tree'), frame = { x: 60, y: 140, width: 1160, height: 520 };
const props = { root: 'How should Northvale move to the new timetable?', branches: [
  { id: 'a', label: 'Switch over in one weekend', conclusions: [{ id: 'a1', text: 'Saves twelve weeks of double crewing' }, { id: 'a2', text: 'Leaves no live test of the rosters' }] },
  { id: 'b', label: 'Run in shadow for twelve weeks', conclusions: [{ id: 'b1', text: 'Costs 1.8m in overtime' }, { id: 'b2', text: 'Finds roster gaps first' }] }] };
const nodes = tree.render({ id: 't', frame, props }).nodes;
assert.ok(!nodes.some((n) => n.role === 'decision-conclusion'));
const boxes = nodes.filter((n) => n.role === 'decision-box');
const top = Math.min(...boxes.map((n) => n.frame.y)), bottom = Math.max(...boxes.map((n) => n.frame.y + n.frame.height));
assert.ok(Math.abs((top - frame.y) - (frame.y + frame.height - bottom)) <= 1, 'the three tiers are centred');
assert.ok(tree.render({ id: 't', frame, props: { ...props, conclusion: 'Shadow running is worth the quarter' } }).nodes.some((n) => n.role === 'decision-conclusion'));
assert.match(error(() => tree.render({ id: 't', frame, props: { ...props, conclusion: ' ' } })), /a sentence, or left out/);
console.log('{}');
""")

    def test_dots_checks_and_binaries_do_three_jobs(self):
        run_node(PRELUDE + """
import { rightFor } from './skills/professional-slides/runtime/claim-fit.mjs';
const jobs = ['dot', 'check', 'binary'].map((form) => rightFor('scorecard', form));
assert.equal(new Set(jobs).size, 3);
assert.match(jobs[0], /no verdict/);
assert.match(jobs[1], /pass/);
assert.match(jobs[2], /neither answer is the better/);
const table = REGISTRY.get('table');
const roles = (type, value) => table.render({ id: 't', frame: { x: 0, y: 0, width: 600, height: 200 }, props: {
  columns: ['Operator', { label: 'Wi-fi', type }], rows: [['Northvale', type === 'binary' ? { type, value, scale: 'answer' } : { type, value }]],
  ...(type === 'binary' ? { scales: { answer: { type: 'binary', label: 'Wi-fi on board', test: 'The operator offers wi-fi', labelDisplay: 'none', states: { yes: 'Yes', no: 'No', missing: 'Not recorded' } } } } : {}) } })
  .nodes.filter((n) => /^table-(dot|check|binary)/.test(n.role)).map((n) => n.role);
assert.deepEqual([...new Set(roles('dot', true))], ['table-dot']);
assert.ok(roles('check', true).every((role) => role.startsWith('table-check')));
assert.deepEqual([...new Set(roles('binary', 'yes'))], ['table-binary-mark']);
console.log('{}');
""")

    def test_a_backdrop_runs_under_its_card_to_the_slide_edges(self):
        run_node(PRELUDE + """
import { SLIDE } from './skills/professional-slides/runtime/core.mjs';
const page = { id: 'b', type: 'picture', form: 'photo-backdrop', commentary: 'captions', takeaway: false, why: 'The claim is about a place, so the evidence sits on it',
  settles: { kind: 'rate', what: 'Saturday load factor by hour on Dales trains' }, adds: 'The caption says who fills the morning trains', title: 'Saturday Dales trains leave Leeds 97% full, fuller than the weekday peak',
  photo: { alt: 'The Dales above Skipton in spring' },
  exhibit: { type: 'chart.column', heading: 'Saturday departures', unit: '% of seats filled', categories: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
    series: [{ name: 'Load factor', values: [24, 51, 88, 97, 90, 72, 58, 44] }], highlights: [{ category: '10:00' }],
    caption: 'Four in five Saturday riders are walkers bound for Skipton, and the last train home leaves before most finish' } };
const [slide] = composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, '.').deck.slides;
const photo = slide.nodes.find((n) => n.id.includes('backdrop') && n.role === 'image-frame');
assert.equal(photo.frame.x, 0);
assert.equal(photo.frame.width, SLIDE.width, 'the photograph runs to both edges');
const card = slide.nodes.find((n) => n.id.includes('-card') && n.role === 'section-surface');
assert.ok(card.frame.y > photo.frame.y + 8 && card.frame.y + card.frame.height < photo.frame.y + photo.frame.height - 8, 'the photograph shows above and below the card');
assert.match(error(() => REGISTRY.get('image-frame').render({ id: 'i', frame: { x: 0, y: 0, width: 100, height: 100 }, props: { alt: 'x', bleed: 'page' } })), /`bleed` is "sides"/);
console.log('{}');
""")

    def test_every_table_archetype_composes_from_a_page(self):
        run_node(PRELUDE + """
const table = REGISTRY.get('table');
const page = (name, exhibit) => ({ id: 'v', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'The reader looks up each row',
  settles: { kind: 'comparison', what: 'the rows of the table' }, title: 'Every row of the table reads at a glance against the others', exhibit: { ...exhibit, variant: name } });
const composed = [];
for (const [name, variant] of Object.entries(table.variants)) {
  const rows = variant.props?.rows;
  if (!rows || rows.length < 3) continue;
  composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page(name, structuredClone(variant.props)))] }, './skills/professional-slides/examples');
  composed.push(name);
}
assert.ok(composed.length >= 20, `${composed.length} archetypes compose from a page`);
const [slide] = composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page('accented-rows', structuredClone(table.variants['accented-rows'].props)))] }, '.').deck.slides;
const bands = slide.nodes.filter((n) => n.role === 'table-row-band').map((n) => n.data.rowStyle);
assert.ok(bands.length >= 3 && bands.every((style) => style === 'accented'), 'every row keeps the accent band');
console.log('{}');
""")

    def test_a_scatter_point_is_read_on_both_axes(self):
        run_node(PRELUDE + """
import { plottedValues } from './skills/professional-slides/runtime/evidence.mjs';
const points = [90, 72, 80, 61, 66, 48, 52].map((y, i) => ({ name: `Route ${i + 1}`, x: 2 + i, y }));
assert.equal(plottedValues({ type: 'chart.scatter', points }), 14);
assert.equal(plottedValues({ type: 'chart.bubble', points: points.map((p) => ({ ...p, size: 4 })) }), 21);
assert.equal(plottedValues({ type: 'chart.column', categories: points.map((p) => p.name), series: [{ name: 'Riders', values: points.map((p) => p.y) }] }), 7);
const page = { id: 'd', type: 'relationship', form: 'scatter', commentary: 'on-exhibit', takeaway: false, why: 'The board sets the off-peak fare from how riders respond to it',
  settles: { kind: 'rate', what: 'off-peak riders against the fare on seven trial routes' }, adds: 'The callout names the route the fare filled', title: 'Each pound off the off-peak fare adds about nine riders a train',
  exhibit: { heading: 'Off-peak fare trial, seven routes', xLabel: 'Fare, £', yLabel: 'Riders a train', points, annotations: [{ target: 'Route 1', text: 'The cheapest fare filled 90 seats a train on the trial' }] } };
assert.ok(compilePage(page), 'a seven-point curve clears the floor');
console.log('{}');
""")

    def test_percent_shares_out_every_stack_and_only_a_stack(self):
        run_node(PRELUDE + """
import { percentStack } from './skills/professional-slides/runtime/compose-charts.mjs';
const data = { categories: ['2019', '2020', '2021', '2022'], series: [{ name: 'Commuting', values: [520, 470, 440, 420] }, { name: 'Leisure', values: [260, 290, 310, 330] }, { name: 'Business', values: [80, 100, 110, 120] }] };
const area = percentStack({ type: 'chart.stacked-area', percent: true, ...data });
assert.equal(area.percent, undefined);
for (let i = 0; i < 4; i++) assert.equal(Math.round(area.series.reduce((sum, s) => sum + s.values[i], 0) * 10) / 10, 100);
assert.equal(area.unit, '% of total');
assert.match(error(() => percentStack({ type: 'chart.line', percent: true, ...data })), /re-expresses a stack/);
assert.equal(percentStack({ type: 'chart.waffle', percent: true, categories: ['A'], series: [{ name: 'n', values: [40] }] }).percent, true);
console.log('{}');
""")

    def test_a_heat_columns_total_is_its_figures_summed(self):
        run_node(PRELUDE + """
import { styleTable } from './skills/professional-slides/runtime/compose-tables.mjs';
const table = styleTable({ columns: ['Station', { label: 'Journeys, k', heat: true }], rows: [['Keighley', '412'], ['Halifax', '288'], ['Selby', '164']], total: true });
assert.deepEqual(table.rows.at(-1).cells, ['Total', { type: 'text', text: '864' }]);
const page = { id: 'm', type: 'lookup', form: 'measure-table', commentary: 'none', takeaway: false, why: 'The reader looks up each station',
  settles: { kind: 'comparison', what: 'journeys at five stations' }, title: 'Keighley carries more journeys than the four smaller stations together',
  exhibit: { columns: ['Station', { label: 'Journeys, k', heat: true }], rows: [['Keighley', '412'], ['Halifax', '288'], ['Selby', '164'], ['Malton', '120'], ['Skipton', '98']] } };
const [slide] = composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, '.').deck.slides;
assert.ok(slide.nodes.some((n) => n.text === '1,082'), 'the total row prints the figures summed');
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
