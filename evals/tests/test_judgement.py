"""How a page is set is chosen from candidates, and a judge settles what a score cannot.

Components say what content they take; the composer offers a page's points every
way a component takes them; the engine lays out and scores every arrangement of
every option; a candidate a component cannot draw in is ruled out by drawing it;
and where the leaders are too close to call, `judge` draws them for the calling
agent, whose choice is recorded on the page and held by every later build.
"""
import unittest

from node_probe import run_node

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const exhibit = { type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C', 'D'], series: [{ name: 'Share', values: [23, 22, 18, 12] }] };
const words = (n) => Array.from({ length: n }, (_, w) => ['evidence', 'the', 'condition', 'reader', 'quarter', 'change'][w % 6]).join(' ') + '.';
const points = (n, length) => Array.from({ length: n }, (_, at) => ({ lead: 'Finding ' + (at + 1), text: words(length) }));
const page = (extra) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'a', slides: [{ id: 's', title: 'Spend is concentrated in three lines', layout: 'arranged', exhibit, ...extra }] })).deck.slides[0];
const drawn = (slide) => slide.componentInstances.map((i) => i.component).filter((name) => ['bullet-list', 'insight', 'paragraph'].includes(name));
const decision = (slide, id) => (slide.decisions || []).find((d) => d.id === id);
'''


class CandidateTests(unittest.TestCase):
    def test_components_say_what_they_take_and_one_point_is_offered_as_a_statement(self):
        result = run_node(PAGE + '''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const one = page({ points: points(1, 18) }), side = decision(one, 's-side-flow-best');
console.log(JSON.stringify({ takes: [REGISTRY.get('insight').takes, REGISTRY.get('bullet-list').takes], reads: REGISTRY.get('insight').reads,
  drawn: drawn(one), chosen: side.chosen, offered: side.candidates.map((c) => c.label) }));
''')
        self.assertEqual(result['takes'], [{'points': [1, 1]}, {'points': [1, 8]}])
        self.assertGreater(result['reads']['maxWidth'], 1000)
        self.assertEqual(result['drawn'], ['insight'])
        self.assertEqual(result['chosen'], 'column / s-points=statement')
        self.assertIn('column / s-points=list', result['offered'])

    def test_a_judges_choice_is_held_and_said_to_be(self):
        result = run_node(PAGE + '''
const held = page({ points: points(1, 18), choices: { 's-side-flow-best': 'column / s-points=list' } });
console.log(JSON.stringify({ drawn: drawn(held), decision: decision(held, 's-side-flow-best') }));
''')
        self.assertEqual(result['drawn'], ['bullet-list'])
        self.assertEqual(result['decision']['chosen'], 'column / s-points=list')
        self.assertTrue(result['decision']['held'])

    def test_parallel_points_under_a_chart_are_blocks_with_the_centred_setting_a_tie_for_a_judge(self):
        result = run_node(PAGE + '''
const three = page({ points: points(3, 12) }), side = decision(three, 's-side-flow-best');
const lists = three.componentInstances.filter((i) => i.component === 'bullet-list').map((i) => i.frame);
console.log(JSON.stringify({ lists: lists.length, across: new Set(lists.map((f) => Math.round(f.y))).size === 1, top: side.candidates.slice(0, 2) }));
''')
        self.assertEqual(result['lists'], 3)
        self.assertTrue(result['across'])
        self.assertEqual([c['label'] for c in result['top']], ['column / s-points=blocks', 'column / s-points=centred'])
        self.assertAlmostEqual(result['top'][0]['score'], result['top'][1]['score'], places=2)

    def test_an_arrangement_a_component_cannot_draw_in_is_not_a_candidate(self):
        # Four long points under the chart leave it no plot; the page is drawn the next best way instead of refused.
        result = run_node(PAGE + '''
const slide = page({ points: points(4, 45) }), chart = slide.componentInstances.find((i) => i.component === 'chart.column').frame;
console.log(JSON.stringify({ chart, row: decision(slide, 's-row-flow-best').chosen }));
''')
        self.assertGreater(result['chart']['height'], 300)
        self.assertTrue(result['row'].startswith('row'))


class TasteTests(unittest.TestCase):
    def test_what_a_page_is_for_changes_how_an_arrangement_is_weighed(self):
        # Presented live, air is cheap and columns are not; read alone, the page is used.
        result = run_node('''
import { arrange } from './skills/professional-slides/runtime/tasteful-layout/index.mjs';
import { DENSITY_PROFILES, TASTE } from './skills/professional-slides/runtime/core.mjs';
const blocks = [{ id: 'a', chars: 150 }, { id: 'b', chars: 150 }, { id: 'c', chars: 150 }];
const measure = (block, width) => Math.ceil((block.chars * 6.6) / Math.min(width, 480)) * 20;
const pick = (weights) => arrange({ id: 'g', blocks }, { width: 1000, height: 400 }, measure, { gap: { major: 32, minor: 16 }, measure: { min: 240, max: 480 }, fill: TASTE.fill, weights: { ...TASTE.weights, ...weights } }).kind;
console.log(JSON.stringify({ live: pick({ whitespace: 0, balance: 0, uniformity: 0, simplicity: 50 }), read: pick(DENSITY_PROFILES['pre-read'].taste), plain: pick(undefined),
  tastes: Object.fromEntries(Object.entries(DENSITY_PROFILES).map(([name, profile]) => [name, profile.taste])) }));
''')
        self.assertEqual(result['live'], 'column')
        self.assertEqual(result['read'], 'row')
        self.assertEqual(result['plain'], 'row')
        self.assertLess(result['tastes']['live-pitch']['whitespace'], 1)
        self.assertGreater(result['tastes']['appendix']['whitespace'], result['tastes']['pre-read']['whitespace'])


    def test_the_pages_rhythm_is_read_from_the_tokens(self):
        # The air between a page's major components, between the blocks inside one, and the measure text is read at
        # are presets (tokens), not numbers inside the engine.
        result = run_node(PAGE + '''
import { TOKENS } from './skills/professional-slides/runtime/core.mjs';
const one = page({ points: points(1, 18) }), chart = one.componentInstances.find((i) => i.component === 'chart.column').frame, box = one.componentInstances.find((i) => i.component === 'insight').frame;
const three = page({ points: points(3, 12) }), lists = three.componentInstances.filter((i) => i.component === 'bullet-list').map((i) => i.frame);
console.log(JSON.stringify({ major: TOKENS['space.major'].value, minor: TOKENS['space.minor'].value, measure: [TOKENS['measure.min'].value, TOKENS['measure.max'].value],
  between: box.y - (chart.y + chart.height), within: lists[1].x - (lists[0].x + lists[0].width) }));
''')
        self.assertEqual(result['between'], result['major'])
        self.assertEqual(result['within'], result['minor'])
        self.assertEqual(result['measure'], [240, 480])


class VerdictTests(unittest.TestCase):
    """Renderings a person preferred, kept as a check on the measures - not as rules: each must come out of the same
    published measures every other page is weighed by."""

    def test_three_findings_under_an_exhibit_are_three_across_not_two_over_one(self):
        result = run_node('''
import { arrange } from './skills/professional-slides/runtime/tasteful-layout/index.mjs';
import { TASTE } from './skills/professional-slides/runtime/core.mjs';
const blocks = ['a', 'b', 'c'].map((id) => ({ id, chars: 150 }));
const measure = (block, width) => Math.ceil((block.chars * 6.6) / Math.min(width, 480)) * 20;
const r = arrange({ id: 'g', blocks }, { width: 1160, height: null }, measure, { gap: { major: 32, minor: 16 }, measure: { min: 240, max: 480 }, ...TASTE });
const score = (label) => r.scores.find((entry) => entry.label === label);
console.log(JSON.stringify({ chosen: r.label, row: score('row 1:1:1').total, lopsided: score('columns 2').total, regularity: score('columns 2').regularity }));
''')
        self.assertEqual(result['chosen'], 'row 1:1:1')
        self.assertLess(result['row'], result['lopsided'])
        self.assertGreater(result['regularity'], 0.4)

    def test_one_figure_in_a_column_is_stacked_large_and_open_with_the_other_settings_offered(self):
        # Verdict: in a narrow column the figure over its explanation uses the room best - it sets far larger than it can
        # beside its explanation - and a box around it earns nothing; the other settings stay candidates for a judge.
        result = run_node(PAGE + '''
const slide = page({ layout: 'hero-number', kpi: { value: '33%', label: 'lower LLM cost per minute', sublabel: 'with model B vs. model A' }, points: points(3, 14).map((p) => p.text) });
const side = decision(slide, 's-side-flow-best'), of = (label) => side.candidates.find((c) => c.label.endsWith(label));
const figure = slide.nodes.find((n) => n.role === 'metric-value');
const chart = slide.componentInstances.find((i) => i.component === 'chart.column').frame, column = slide.componentInstances.find((i) => i.id === 's-side').frame;
console.log(JSON.stringify({ chosen: side.chosen, stacked: of('=stacked'), beside: of('=beside'), boxed: of('=boxed'), size: figure.frame.height,
  between: Math.max(chart.x - (column.x + column.width), column.x - (chart.x + chart.width)) }));
''')
        self.assertTrue(result['chosen'].endswith('=stacked'))
        self.assertGreater(result['beside']['proportion'], result['stacked']['proportion'])
        # A ground of its own is a part of the page, and counts as one.
        self.assertGreater(result['boxed']['simplicity'], result['beside']['simplicity'])
        self.assertGreater(result['size'], 80)
        # The figure's column and the exhibit stand a major gap apart.
        self.assertAlmostEqual(result['between'], 32, delta=1)


    def test_two_pages_running_vary_their_figure_where_another_setting_is_about_as_good(self):
        # Verdict: a deck may use two settings for its figures - but quality first. Each page is weighed against how the
        # deck last set the same kind of content; a repeat is marked down only where a fresh setting is about as good.
        result = run_node('''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const exhibit = { type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C', 'D'], series: [{ name: 'Share', values: [23, 22, 18, 12] }] };
const page = (id, kpi, points) => ({ id, title: 'Spend is concentrated in three lines', layout: 'hero-number', exhibit, kpi, points });
// A short figure with a short label reads about as well beside its label as over it...
const even = (id, value) => page(id, { value, label: 'Lead model score' }, ['One short point.']);
// ...a figure with a long explanation over several points does not: beside, it has to be set far smaller.
const uneven = (id, value) => page(id, { value, label: 'lower LLM cost per minute', sublabel: 'with model B vs. model A' }, [1, 2, 3].map(() => 'evidence the condition reader quarter change evidence the condition reader quarter change evidence the.'));
const families = (slides) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'two', slides })).deck.slides
  .map((slide) => (slide.decisions || []).flatMap((d) => Object.entries(d.families || {})).filter(([kind]) => kind === 'figure').map(([, family]) => family)[0]);
console.log(JSON.stringify({ even: families([even('a', '58'), even('b', '61'), even('c', '47')]), uneven: families([uneven('a', '33%'), uneven('b', '41%')]) }));
''')
        self.assertEqual(result['even'], ['stacked', 'beside', 'stacked'])
        self.assertEqual(result['uneven'], ['stacked', 'stacked'])


class OneOutlineTests(unittest.TestCase):
    def test_a_labelled_arrow_is_one_outline_in_both_outputs_and_holds_its_label(self):
        # A preset arrow's shaft is half its height in PowerPoint, so the label spilled out of it there and not in HTML.
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const nodes = REGISTRY.get('arrow-rows').render({ id: 'a', frame: { x: 0, y: 0, width: 760, height: 400 }, props: { items: [{ label: 'Tuned for contact centers', text: 'Finds the right playbook.', icon: 'people' }, { label: 'Top performance', text: 'Top five in every skill.' }] } }).nodes;
const shapes = nodes.filter((n) => n.role === 'arrow-row-shape'), labels = nodes.filter((n) => n.role === 'arrow-row-label');
console.log(JSON.stringify({ geometry: shapes.map((n) => n.data.geometry), body: shapes.map((n) => n.data.paths[0][1][0] * n.frame.width),
  inside: labels.every((label, at) => label.frame.y >= shapes[at].frame.y && label.frame.y + label.frame.height <= shapes[at].frame.y + shapes[at].frame.height && label.frame.x + label.frame.width <= shapes[at].frame.x + shapes[at].data.paths[0][1][0] * shapes[at].frame.width + 0.5) }));
''')
        self.assertEqual(set(result['geometry']), {'customPolygon'})
        self.assertTrue(result['inside'])


class JudgeCommandTests(unittest.TestCase):
    def test_judge_asks_once_a_decision_records_the_answer_and_ends(self):
        result = run_node('''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { execute } from './skills/professional-slides/runtime/command.mjs';
const doc = workedExamples(), base = doc.pages.find((p) => p.type === 'trend' && p.exhibit && p.points?.length);
delete base.pointsStyle; delete base.highlight;
const words = (n) => Array.from({ length: n }, (_, w) => ['evidence', 'the', 'margin', 'reader', 'quarter', 'change'][w % 6]).join(' ') + '.';
doc.pages = [{ ...base, id: 'three', title: 'Three things moved the margin over the period', commentary: 'auto', points: [1, 2, 3].map((n) => ({ lead: `Finding ${n}`, text: words(11) })) }];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-judge-'));
fs.writeFileSync(path.join(work, 'deck.pages.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(work, 'project.json'), JSON.stringify({ schema: 'professional-slides.project/v1', pages: 'deck.pages.json' }));
const rounds = [];
for (let round = 0; round < 6; round += 1) {
  const asked = await execute(['judge', work]);
  if (asked.status !== 'needs-input') { rounds.push({ status: asked.status }); break; }
  const input = asked.requiredInputs[0], taken = input.candidates.at(-1).label;
  fs.writeFileSync(path.join(work, 'choices.json'), JSON.stringify({ three: { [input.decision]: taken } }));
  const recorded = await execute(['judge', work, '--choices', path.join(work, 'choices.json')]);
  rounds.push({ status: asked.status, kind: input.kind, decision: input.decision, labels: input.candidates.map((c) => c.label), taken, rubric: asked.rubric.length, recorded: recorded.status });
}
const pagesFile = path.join(work, 'deck.pages.json'), withStale = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
const before = (await execute(['judge', work])).stale ?? [];
withStale.pages[0].choices = { ...withStale.pages[0].choices, 'three-gone-flow-best': 'row 9:1' };
fs.writeFileSync(pagesFile, JSON.stringify(withStale));
const after = (await execute(['judge', work])).stale ?? [];
delete withStale.pages[0].choices['three-gone-flow-best'];
fs.writeFileSync(pagesFile, JSON.stringify(withStale));
const verdicts = fs.readFileSync(path.join(work, 'judgement', 'verdicts.jsonl'), 'utf8').trim().split(/\\n/).map((line) => JSON.parse(line));
const kept = JSON.parse(fs.readFileSync(path.join(work, 'deck.pages.json'), 'utf8')).pages[0].choices;
fs.rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify({ rounds, stale: [before.length, after.map((entry) => entry.decision)], kept, verdicts }));
''')
        asked = [r for r in result['rounds'] if r['status'] == 'needs-input']
        # Every decision the engine made between candidates is put to the judge once, the page's own arrangement first...
        self.assertEqual(asked[0]['kind'], 'judgement')
        self.assertTrue(asked[0]['decision'].endswith('-row-flow-best'))
        self.assertGreater(len(asked[0]['labels']), 1)
        self.assertGreater(asked[0]['rubric'], 3)
        # ...the loop ends by itself, within the rounds a page is given...
        self.assertEqual(result['rounds'][-1]['status'], 'complete')
        self.assertLessEqual(len(asked), 3)
        # ...each choice is kept on the page, and filed as a verdict with the measures it was chosen over.
        self.assertEqual(result['kept'], {r['decision']: r['taken'] for r in asked})
        self.assertEqual([v['chosen'] for v in result['verdicts']], [r['taken'] for r in asked])
        self.assertIn('balance', result['verdicts'][0]['candidates'][0]['measures'])
        # A recorded choice the page no longer honours is named, not kept silently.
        self.assertEqual(result['stale'], [0, ['three-gone-flow-best']])


if __name__ == '__main__':
    unittest.main()
