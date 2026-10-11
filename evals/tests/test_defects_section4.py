"""Defects a probe of the catalogue found, each held where it was fixed.

A funnel that said it drew conversion rates and drew none; a heat key printed
once per column over columns that share one scale; a bar chart's deltas
heading set across its legend; a radar held under its points; an agenda in
columns floating between two empty bands; a median cut away beside labels it
never touched; a cover rule drawn in the cover's own colour.
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


if __name__ == "__main__":
    unittest.main()
