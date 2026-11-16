"""The review findings on the Taffy rebuild (PR 14), each held by the test that reproduced it.

- A way of setting a page's points is offered only for points it draws whole: a statement or a centred row that kept a
  point's lead and text and dropped its sub-points lost them from both outputs, and the content audit did not notice.
- A fixed track stays fixed: `240px` in a template, or the connector's width beside an exhibit, was read as a share of
  the row (`{ fr: 240 }`) and left the column beside it a few pixels wide.
- The judge reads the pages as the deck is built from them: pages written in a part file, and appendix pages, are
  judged, and a choice is recorded in the file that holds its page.
- A revision that carries slides from the user's PowerPoint is refused an HTML output, whatever else is asked with it,
  before anything is written: HTML draws only the composed pages, so it would be part of the deck presented as all of it.
- A build of both outputs returns the HTML output's photographs as artifacts, as an HTML build does.
"""
import unittest

from node_probe import requires_chromium, requires_python_package, run_node

CHART = "{ type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Share', values: [23, 22, 18] }] }"

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const compose = (slides) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'review', slides })).deck;
const frames = (slide) => Object.fromEntries(slide.componentInstances.map((instance) => [instance.id, instance.frame]));
const texts = (slide) => slide.nodes.filter((node) => node.type === 'text').map((node) => node.data?.textLayout?.source ?? node.text);
const tried = (work) => { try { return { value: work() }; } catch (error) { return { error: error.message }; } };
'''

# A workspace of one page from the worked examples: a trend chart with three led findings, which the engine sets more
# than one way and so puts to the judge.
WORKSPACE = '''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { execute } from './skills/professional-slides/runtime/command.mjs';
const doc = workedExamples(), base = doc.pages.find((p) => p.type === 'trend' && p.exhibit && p.points?.length);
delete base.pointsStyle; delete base.highlight;
const words = (n) => Array.from({ length: n }, (_, w) => ['evidence', 'the', 'margin', 'reader', 'quarter', 'change'][w % 6]).join(' ') + '.';
const judged = (id, title) => ({ ...base, id, title, commentary: 'auto', points: [1, 2, 3].map((n) => ({ lead: `Finding ${n}`, text: words(11) })) });
const workspace = (pages, files = {}) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-review-'));
  fs.writeFileSync(path.join(work, 'deck.pages.json'), JSON.stringify({ ...doc, ...pages }));
  fs.writeFileSync(path.join(work, 'project.json'), JSON.stringify({ schema: 'professional-slides.project/v1', pages: 'deck.pages.json' }));
  for (const [name, value] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(work, name)), { recursive: true }); fs.writeFileSync(path.join(work, name), JSON.stringify(value)); }
  return work;
};
const read = (work, name) => JSON.parse(fs.readFileSync(path.join(work, name), 'utf8'));
// One round: ask, take the engine's runner-up for every page asked, record it.
const round = async (work) => {
  let asked;
  try { asked = await execute(['judge', work]); } catch (error) { return { error: error.message }; }
  if (asked.status !== 'needs-input') return { status: asked.status };
  const chosen = Object.fromEntries(asked.requiredInputs.map((input) => [input.page, { [input.decision]: input.candidates.at(-1).label }]));
  fs.writeFileSync(path.join(work, 'choices.json'), JSON.stringify(chosen));
  try { return { status: asked.status, pages: asked.requiredInputs.map((input) => input.page), chosen, recorded: (await execute(['judge', work, '--choices', path.join(work, 'choices.json')])).status }; }
  catch (error) { return { status: asked.status, pages: asked.requiredInputs.map((input) => input.page), chosen, recordError: error.message }; }
};
'''


class NestedPointsTests(unittest.TestCase):
    """Finding 1: the statement and centred ways kept a point's lead and text and dropped its sub-points."""

    def test_a_point_with_sub_points_is_set_only_in_ways_that_draw_them(self):
        result = run_node(PAGE + f'''
import {{ pointWays }} from './skills/professional-slides/runtime/compose-points.mjs';
import {{ REGISTRY }} from './skills/professional-slides/runtime/registry.mjs';
const nested = {{ lead: 'Finding', text: 'Spend is concentrated.', points: ['Nested evidence is required.', 'Second fact must remain.'] }};
const ways = (points) => pointWays(points, {{ id: 'p', tone: 'open', fill: 'balanced', style: null }}, REGISTRY).map((way) => way.label);
const slide = compose([{{ id: 's', title: 'Spend is concentrated in three suppliers', layout: 'arranged', exhibit: {CHART}, points: [nested] }}]).slides[0];
console.log(JSON.stringify({{ texts: texts(slide), chosen: slide.decisions.map((d) => d.chosen),
  one: ways([nested]), plainOne: ways([{{ lead: 'Finding', text: 'Spend is concentrated.' }}]),
  two: ways([nested, {{ lead: 'Second', text: 'Another finding.' }}]), plainTwo: ways([{{ lead: 'First', text: 'A finding.' }}, {{ lead: 'Second', text: 'Another finding.' }}]) }}));
''')
        # The page that dropped them draws every sub-point now...
        for text in ('Finding', 'Spend is concentrated.', 'Nested evidence is required.', 'Second fact must remain.'):
            self.assertTrue(any(text in drawn for drawn in result['texts']), text)
        self.assertFalse(any('statement' in str(chosen) for chosen in result['chosen']), result['chosen'])
        # ...because a way that draws a lead and a text alone is not offered points that say more...
        self.assertNotIn('statement', result['one'])
        self.assertNotIn('centred', result['two'])
        # ...and is still offered the points it draws whole.
        self.assertIn('statement', result['plainOne'])
        self.assertIn('centred', result['plainTwo'])

    def test_the_content_audit_finds_a_sub_point_no_page_draws(self):
        result = run_node('''
import { auditContent } from './skills/professional-slides/runtime/content-audit.mjs';
const title = 'Spend is concentrated in three suppliers';
const slide = { id: 's', title, points: [{ lead: 'Finding', text: 'Spend is concentrated.', points: ['Nested evidence is required.', { lead: 'Second', text: 'fact must remain.' }] }] };
// The scene the statement drew: the point's lead and text, and nothing of its sub-points.
const scene = { slides: [{ nodes: [{ type: 'text', role: 'action-title', text: title }, { type: 'text', text: 'Finding' }, { type: 'text', text: 'Spend is concentrated.' }] }] };
const whole = { slides: [{ nodes: [...scene.slides[0].nodes, { type: 'text', text: 'Nested evidence is required.' }, { type: 'text', text: 'Second: fact must remain.' }] }] };
console.log(JSON.stringify({ lost: auditContent({ slides: [slide] }, scene), kept: auditContent({ slides: [slide] }, whole) }));
''')
        self.assertFalse(result['lost']['accepted'])
        self.assertEqual(sorted(f['text'] for f in result['lost']['findings']), ['Nested evidence is required.', 'Second', 'fact must remain.'])
        self.assertTrue(result['kept']['accepted'], result['kept']['findings'])


class FixedTrackTests(unittest.TestCase):
    """Finding 2: a length in a template was read as a weight, and the connector's fixed width as a share."""

    def test_a_fixed_column_and_a_fixed_row_keep_their_length(self):
        result = run_node(PAGE + '''
const points = ['Answers in about 150 ms', 'Top of the voice benchmark'];
const paragraphs = ['A paragraph that should take the rest of the row and read at its own measure.'];
const across = tried(() => frames(compose([{ id: 'g', title: 'A fixed column keeps its width beside the prose', points, paragraphs, grid: { columns: '240px 1fr', areas: ['points paragraphs'] } }]).slides[0]));
const down = tried(() => frames(compose([{ id: 'r', title: 'A fixed row keeps its height over the prose', points, paragraphs, grid: { rows: '120px 1fr', areas: ['points', 'paragraphs'] } }]).slides[0]));
// A fixed track among alternatives is fixed in each of them.
const offered = tried(() => compose([{ id: 'o', title: 'A fixed column offered two ways keeps either width', points, paragraphs, grid: { columns: ['240px 1fr', '320px 1fr'], areas: ['points paragraphs'] } }]).slides[0]);
console.log(JSON.stringify({ across, down, offered: offered.error ? offered : { frames: frames(offered.value), decision: offered.value.decisions.find((d) => d.id === 'o-template') ?? null } }));
''')
        self.assertNotIn('error', result['across'], result['across'].get('error'))
        across = result['across']['value']
        # 240px, a major gap (32px), and the paragraph the rest of the 1160px body.
        self.assertAlmostEqual(across['g-p0']['width'], 1160 - 240 - 32, delta=0.5)
        self.assertAlmostEqual(across['g-p0']['x'] - across['g-template']['x'], 240 + 32, delta=0.5)
        self.assertNotIn('error', result['down'], result['down'].get('error'))
        down = result['down']['value']
        # The first row 120px from the grid's top, a major gap, and the paragraph's row the rest of the body's height.
        self.assertAlmostEqual(down['r-p0']['y'] - down['r-template']['y'], 120 + 32, delta=0.5)
        self.assertAlmostEqual(down['r-p0']['height'], down['r-template']['height'] - 120 - 32, delta=0.5)
        self.assertNotIn('error', result['offered'], result['offered'].get('error'))
        self.assertIn(round(result['offered']['frames']['o-p0']['width']), (1160 - 240 - 32, 1160 - 320 - 32))

    def test_the_connector_beside_an_exhibit_is_its_own_width_and_the_commentary_keeps_its_share(self):
        result = run_node(PAGE + f'''
import {{ CONNECTOR_WIDTH }} from './skills/professional-slides/runtime/compose-body.mjs';
const page = tried(() => frames(compose([{{ id: 'c', title: 'Spend is concentrated in three suppliers', layout: 'exhibit-left', implication: 'chevron', exhibit: {CHART},
  points: ['Answers in about 150 ms', 'Top of the voice benchmark'] }}]).slides[0]));
console.log(JSON.stringify({{ page, connector: CONNECTOR_WIDTH }}));
''')
        self.assertNotIn('error', result['page'], result['page'].get('error'))
        frames = result['page']['value']
        self.assertAlmostEqual(frames['c-implication']['width'], result['connector'], delta=0.01)
        # The exhibit two shares of the row and the commentary one (or one and a half), the connector's width taken out first.
        points = [frame for key, frame in frames.items() if key.startswith('c-points')]
        self.assertGreater(min(frame['width'] for frame in points), 300)


class JudgeTests(unittest.TestCase):
    """Findings 3 and 4: the judge read the raw pages file - no part's pages, no appendix - and wrote choices only to it."""

    def test_a_page_written_in_a_part_is_judged_and_its_choice_recorded_in_the_part(self):
        result = run_node(WORKSPACE + '''
const work = workspace({ pages: [{ include: 'pages/part.json' }] }, { 'pages/part.json': { pages: [judged('three', 'Three things moved the margin over the period')] } });
const first = await round(work);
const root = read(work, 'deck.pages.json'), part = read(work, 'pages/part.json');
fs.rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify({ first, root: root.pages, part: part.pages[0].choices ?? null }));
''')
        first = result['first']
        self.assertNotIn('error', first, first.get('error'))
        self.assertNotIn('recordError', first, first.get('recordError'))
        self.assertEqual(first['pages'], ['three'])
        self.assertEqual(first['recorded'], 'complete')
        # The choice is on the page in its part; the pages file keeps its include and gains no copy of the page.
        self.assertEqual(result['part'], first['chosen']['three'])
        self.assertEqual(result['root'], [{'include': 'pages/part.json'}])

    def test_an_appendix_page_is_judged_and_its_choice_recorded_on_it(self):
        result = run_node(WORKSPACE + '''
const work = workspace({ pages: [{ ...base, id: 'one', title: 'One page in the body of the deck', points: undefined, commentary: undefined }],
  appendix: [{ include: 'appendix/part.json' }, judged('four', 'Four things moved the margin in the appendix')] },
  { 'appendix/part.json': { pages: [judged('five', 'Five things moved the margin in the appendix part')] } });
const first = await round(work);
const root = read(work, 'deck.pages.json'), part = read(work, 'appendix/part.json');
fs.rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify({ first, four: root.appendix.find((p) => p.id === 'four')?.choices ?? null, include: root.appendix[0], five: part.pages[0].choices ?? null }));
''')
        first = result['first']
        self.assertNotIn('error', first, first.get('error'))
        self.assertNotIn('recordError', first, first.get('recordError'))
        self.assertIn('four', first['pages'])
        self.assertIn('five', first['pages'])
        self.assertEqual(first['recorded'], 'complete')
        self.assertEqual(result['four'], first['chosen']['four'])
        self.assertEqual(result['five'], first['chosen']['five'])
        self.assertEqual(result['include'], {'include': 'appendix/part.json'})


class CarriedSlidesTests(unittest.TestCase):
    """Finding 5: `--format both` built an HTML deck without the carried slides and said nothing."""

    def test_any_html_output_of_a_deck_that_carries_slides_is_refused_before_anything_is_written(self):
        result = run_node('''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDeck } from './skills/professional-slides/runtime/build-deck.mjs';
const spec = { schema: 'professional-slides.deck/v3', id: 'rev', workflow: 'existing_deck_revision', inventory: 'rev.inventory.json', carried: [{ slide: 1 }, { slide: 2 }], slides: [] };
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-carried-'));
const outcomes = {};
for (const formats of [['html'], ['pptx', 'html']]) {
  const out = path.join(base, formats.join('-'));
  try { await buildDeck(null, out, { source: { spec, baseDir: base }, formats, render: false, fetchLogos: false }); outcomes[formats.join('+')] = { built: true }; }
  catch (error) { outcomes[formats.join('+')] = { name: error.name, message: error.message, written: fs.existsSync(out) ? fs.readdirSync(out) : [] }; }
}
fs.rmSync(base, { recursive: true, force: true });
console.log(JSON.stringify(outcomes));
''')
        for formats, outcome in result.items():
            self.assertEqual(outcome.get('name'), 'UsageError', (formats, outcome))
            # It says why, and what to run instead.
            self.assertIn('HTML', outcome['message'])
            self.assertIn('--format pptx', outcome['message'])
            self.assertEqual(outcome['written'], [], formats)


@requires_python_package('pptx')
class BothFormatsTests(unittest.TestCase):
    """Finding 6: a build of both outputs did not return the HTML output's photographs."""

    @requires_chromium
    def test_a_build_of_both_outputs_returns_the_html_photographs_and_its_findings(self):
        result = run_node(WORKSPACE + '''
import { openWorkspace, buildWorkspace } from './skills/professional-slides/runtime/public/workspace.mjs';
const page = { ...base, id: 'one', title: 'One page built both ways for the review' };
const work = workspace({ pages: [page] }), out = path.join(work, 'out');
const built = await buildWorkspace(await openWorkspace(work), out, { formats: ['pptx', 'html'], fetch: false });
const written = read(work, 'out/build-result.json');
fs.rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify({ artifacts: built.artifacts ?? [], findings: built.findings ?? [], html: written.html?.render?.renders ?? [], htmlPath: written.htmlPath ?? null,
  htmlBlockers: (written.blockers || []).filter((b) => /html/.test(b.source)) }));
''')
        self.assertTrue(result['html'], 'the HTML output was photographed')
        for image in result['html']:
            self.assertIn(image, result['artifacts'])
        self.assertIn(result['htmlPath'], result['artifacts'])
        for blocker in result['htmlBlockers']:
            self.assertIn(blocker, result['findings'])


if __name__ == '__main__':
    unittest.main()
