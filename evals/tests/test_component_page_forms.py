"""Registered components that could not fill a page.

Seven gained a page form, each with a worked example and a row in the fit
table: a range (the football field), radial bars, an organization chart, a
placement map, an insight tree, a rollout and a device screenshot. Seven are
strips, bands or blanks that cannot fill a page, and each has a documented
route to one. Along the way: a statement page dropped the exhibit written
with it, an organization set by hand was refused for lacking the automatic
layout's keys, and the organization, placement and rollout layouts left the
page they were given half empty or squeezed their labels.
"""
import re
import unittest

from node_probe import ROOT, run_node

FORMS = ["ranking/range", "composition/radial-bars", "mechanism/organization", "mechanism/placement",
         "mechanism/insight-tree", "schedule/rollout", "picture/device"]
ROUTED = ["journey", "highlight-strip", "icon-trends", "speech", "logo-collage", "status-list", "worksheet"]

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { carrierOf } from './skills/professional-slides/runtime/claim-fit.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const compose = (page) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [compilePage(page)] }, './skills/professional-slides/examples').deck.slides[0];
"""


class FormTests(unittest.TestCase):
    def test_every_new_form_has_a_worked_page_that_composes_and_a_fit_row(self):
        run_node(PRELUDE + f"""
const pages = workedExamples().pages;
for (const key of {FORMS!r}) {{
  const [type, form] = key.split('/');
  assert.ok(PAGE_TYPES[type].forms[form], `${{key}} is a form`);
  const page = pages.find((p) => p.type === type && p.form === form);
  assert.ok(page, `${{key}} has a worked page for --example`);
  assert.ok(compose(page).nodes.length > 10, `${{key}} composes`);
  const row = carrierOf(type, form);
  assert.ok(row && (row.shows || Object.keys(row.carries).length), `${{key}} is graded`);
}}
console.log('{{}}');
""")

    def test_the_routed_components_are_documented_and_reach_a_page(self):
        doc = (ROOT / "skills/professional-slides/references/page-types.md").read_text(encoding="utf-8")
        routes = re.search(r"\*\*Components without a page form\.\*\*(.*?)\n\n[^-]", doc, re.S).group(1)
        for component in ROUTED:
            self.assertIn(f"`{component}`", routes, component)
        run_node(PRELUDE + f"""
const chart = {{ type: 'chart.column', heading: 'Weekend journeys', unit: 'thousand', categories: ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'], series: [{{ name: 'Journeys', values: [330, 150, 310, 360, 395, 420, 455, 480] }}] }};
for (const component of {ROUTED!r}) {{
  const sample = structuredClone(REGISTRY.get(component).sample);
  if (component === 'logo-collage') sample.items = ['northvale-rail', 'westmoor-trains', 'tideway-rail', 'pennine-link'].map((name) => ({{ name, logo: {{ path: `assets/logos/${{name}}.png`, alt: `${{name}} logo`, credit: 'Illustration drawn for this example' }} }}));
  if (component === 'icon-trends') sample.items = sample.items.map(({{ media, ...item }}, i) => ({{ ...item, icon: ['building', 'leaf', 'people'][i % 3] }}));
  const page = {{ id: 'r', type: 'panels', form: 'dashboard', commentary: 'none', takeaway: false, why: 'Several readings of the network at a glance',
    settles: {{ kind: 'comparison', what: 'weekend journeys and what riders say' }}, title: 'Weekend journeys grew every year as leisure overtook commuting',
    grid: {{ columns: [1, 1], rows: [1] }}, exhibits: [chart, {{ ...sample, type: component, heading: 'Beside the journeys' }}], source: 'Source: illustrative; synthetic' }};
  assert.ok(compose(page).nodes.some((n) => String(n.data?.componentInstance ?? '').includes('exhibit')), `${{component}} reaches a page as a dashboard area`);
}}
console.log('{{}}');
""")


class DefectTests(unittest.TestCase):
    def test_a_statement_page_refuses_the_exhibit_it_would_drop(self):
        run_node(PRELUDE + """
const exhibit = { type: 'chart.column', categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] };
assert.match(error(() => compilePage({ id: 's', type: 'statement', form: 'statement', commentary: 'none', why: 'The deck turns on it', settles: { kind: 'qualitative', what: 'the plan' },
  title: 'The plan pays back in four years', text: 'The plan pays back in four years', exhibit })), /draws no exhibit/);
assert.match(error(() => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: [{ kind: 'statement', title: 'x', text: 'The plan pays back in four years', exhibit }] }, '.')), /draws no exhibit/);
console.log('{}');
""")

    def test_an_organization_set_by_hand_compiles(self):
        run_node(PRELUDE + """
const page = { id: 'o', type: 'mechanism', form: 'organization', commentary: 'none', takeaway: false, why: 'Who reports to whom across three levels',
  settles: { kind: 'structure', what: 'the programme reporting lines' }, title: 'Five leads report to one director through two deputies',
  exhibit: { nodes: [{ id: 'd', label: 'Director', x: 0.4, y: 0, width: 0.2, height: 0.15, tone: 'primary' }, { id: 'a', label: 'Deputy A', x: 0.15, y: 0.4, width: 0.2, height: 0.15 },
    { id: 'b', label: 'Deputy B', x: 0.65, y: 0.4, width: 0.2, height: 0.15 }], connectors: [{ from: 'd', to: 'a' }, { from: 'd', to: 'b' }] } };
assert.ok(compilePage(page));
console.log('{}');
""")


class LayoutTests(unittest.TestCase):
    def test_an_organization_is_centred_on_a_bus(self):
        run_node(PRELUDE + """
const frame = { x: 60, y: 140, width: 760, height: 500 };
const nodes = REGISTRY.get('organization').render({ id: 'o', frame, props: { root: 'Programme director', children: ['Timetable lead', 'Crews lead', 'Fleet lead', 'Passenger communications lead'] } }).nodes;
const boxes = nodes.filter((n) => n.type === 'rect');
const top = Math.min(...boxes.map((n) => n.frame.y)), bottom = Math.max(...boxes.map((n) => n.frame.y + n.frame.height));
assert.ok(Math.abs((top - frame.y) - (frame.y + frame.height - bottom)) <= 1, 'the two tiers are centred');
for (const line of nodes.filter((n) => n.role === 'tree-connector')) assert.ok(line.frame.width < 0.5 || line.frame.height < 0.5, 'reporting lines run square, on a bus');
assert.ok(nodes.filter((n) => n.role === 'node-label').every((n) => n.data?.textLayout), 'every role is measured where it wraps');
console.log('{}');
""")

    def test_placement_tiles_fill_the_longest_column(self):
        run_node(PRELUDE + """
const frame = { x: 60, y: 140, width: 1160, height: 400 };
const items = [0, 0, 1, 1, 1, 1, 2].map((column, i) => ({ label: `Capability ${i + 1}`, column }));
const nodes = REGISTRY.get('placement').render({ id: 'p', frame, props: { columns: [{ label: 'Operations' }, { label: 'Passenger' }, { label: 'Commercial' }], items } }).nodes;
const tiles = nodes.filter((n) => n.role === 'placement-item');
const lowest = Math.max(...tiles.map((n) => n.frame.y + n.frame.height));
assert.ok(frame.y + frame.height - lowest <= 16, 'the longest column runs to the foot of its well');
assert.equal(new Set(tiles.map((n) => Math.round(n.frame.height))).size, 1, 'one tile height across the grid');
console.log('{}');
""")

    def test_a_rollout_row_named_in_words_takes_a_column(self):
        run_node(PRELUDE + """
const render = (labels) => REGISTRY.get('initiative-rollout').render({ id: 'r', frame: { x: 60, y: 140, width: 1160, height: 400 },
  props: { years: ['FY27', 'FY28', 'FY29'], rows: labels.map((label) => ({ label, phases: ['Design', 'Build', 'Run'] })) } }).nodes;
const named = render(['Timetable recast', 'Flexible fares']);
assert.ok(!named.some((n) => n.role === 'rollout-row-marker'), 'no disc for a name');
assert.ok(named.filter((n) => n.role === 'rollout-row-label').every((n) => n.data?.textLayout?.lines?.length <= 2));
assert.equal(render(['A', 'B']).filter((n) => n.role === 'rollout-row-marker').length, 2, 'a code keeps its disc');
console.log('{}');
""")

    def test_icon_trends_take_an_icon_and_a_collage_takes_logo_files(self):
        run_node(PRELUDE + """
const trends = REGISTRY.get('icon-trends').render({ id: 't', frame: { x: 60, y: 140, width: 1160, height: 400 },
  props: { items: [{ id: 'a', icon: 'building', title: 'Hybrid work', text: 'Office days fell.' }, { id: 'b', icon: 'leaf', title: 'Leisure', text: 'Weekend trips grew.' }] } }).nodes;
assert.ok(trends.some((n) => n.role?.startsWith('trend-icon')));
const page = { id: 'r', type: 'panels', form: 'dashboard', commentary: 'none', takeaway: false, why: 'The bidders at a glance', settles: { kind: 'comparison', what: 'the bidders and the market they bid for' },
  title: 'Four operators bid for the Coast concession against a growing market', grid: { columns: [1, 1], rows: [1] },
  exhibits: [{ type: 'chart.column', heading: 'Coast journeys', unit: 'm', categories: ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'], series: [{ name: 'Journeys', values: [3, 1, 2, 3, 3, 4, 4, 5] }] },
    { type: 'logo-collage', heading: 'The bidders', items: ['northvale-rail', 'westmoor-trains', 'tideway-rail', 'pennine-link'].map((name) => ({ name, logo: { path: `assets/logos/${name}.png`, alt: name, credit: 'Illustration drawn for this example' } })) }],
  source: 'Source: illustrative; synthetic' };
assert.equal(compose(page).nodes.filter((n) => n.role === 'logo').length, 4, 'four named files drawn in their own colours');
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
