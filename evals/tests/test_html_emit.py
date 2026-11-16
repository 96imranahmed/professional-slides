"""One scene, two outputs: the HTML emitter draws what the PowerPoint emitter draws.

The scene keeps the layout tree its frames were resolved from (`slide.layout`),
every container in CSS grid's vocabulary, and `emit/emit_html.mjs` writes that
tree as real grid containers with each component's primitives inside it. These
tests hold the two ends of that: the tree accounts for every primitive and every
frame, and a browser sets each element where the scene - and so the saved
PowerPoint - has it.
"""
import unittest

from node_probe import requires_chromium, run_node

COMPOSE = '''
import fs from 'node:fs';
import path from 'node:path';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { deckHtml, slideHtml } from './skills/professional-slides/runtime/emit/emit_html.mjs';
const file = './skills/professional-slides/examples/%s.deck.json';
const { deck } = composeAll(JSON.parse(fs.readFileSync(file, 'utf8')), path.dirname(file));
'''


class LayoutTreeTests(unittest.TestCase):
    def test_every_component_instance_is_a_box_of_the_tree_at_its_own_frame(self):
        result = run_node(COMPOSE % 'gallery-acceptance' + '''
let instances = 0, boxed = 0, moved = 0, containers = new Set();
for (const slide of deck.slides) {
  const boxes = new Map();
  const walk = (box) => { if (box.instance) boxes.set(box.instance, box); else containers.add(box.kind); (box.children || []).forEach(walk); };
  walk(slide.layout);
  for (const instance of slide.componentInstances) {
    instances += 1;
    const box = boxes.get(instance.instanceId);
    if (!box) continue;
    boxed += 1;
    if (['x', 'y', 'width', 'height'].some((key) => Math.abs(box.frame[key] - instance.frame[key]) > 0.01)) moved += 1;
  }
}
console.log(JSON.stringify({ slides: deck.slides.length, instances, boxed, moved, containers: [...containers].sort() }));
''')
        self.assertGreater(result['slides'], 100)
        self.assertEqual(result['boxed'], result['instances'])
        self.assertEqual(result['moved'], 0)
        # Every container is one of the grid kinds the emitters know.
        self.assertLessEqual(set(result['containers']), {'page', 'row', 'column', 'grid', 'stack', 'absolute'})

    def test_a_flow_is_recorded_as_grid_tracks_that_fill_its_frame(self):
        result = run_node(COMPOSE % 'nyc-or-sf' + '''
const bad = [];
const walk = (box) => {
  if (box.kind === 'row' || box.kind === 'column') {
    const p = box.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const room = box.kind === 'row' ? box.frame.width - p.left - p.right : box.frame.height - p.top - p.bottom;
    const used = box.tracks.reduce((sum, value) => sum + value, 0) + box.gap * Math.max(0, box.tracks.length - 1);
    if (used > room + 0.5 || box.tracks.length !== box.template.length || box.tracks.length !== (box.children || []).length) bad.push(box.id);
  }
  (box.children || []).forEach(walk);
};
deck.slides.forEach((slide) => walk(slide.layout));
const side = JSON.stringify(deck.slides[2].layout).match(/"template":\\{"columns":\\["2fr","1fr"\\]/);
console.log(JSON.stringify({ bad, authoredTracksKept: Boolean(side) }));
''')
        self.assertEqual(result['bad'], [])
        self.assertTrue(result['authoredTracksKept'])


class HtmlEmitterTests(unittest.TestCase):
    def test_the_page_is_grid_containers_holding_every_primitive_once(self):
        result = run_node(COMPOSE % 'nyc-or-sf' + '''
const slide = deck.slides[2], html = slideHtml(slide, { index: 2 });
const ids = [...html.matchAll(/data-node-id="([^"]+)"/g)].map((m) => m[1]);
console.log(JSON.stringify({ nodes: slide.nodes.length, drawn: ids.length, distinct: new Set(ids).size,
  grids: (html.match(/display:grid/g) || []).length, components: (html.match(/data-component="/g) || []).length,
  tokens: /--ink:#/.test(html) && /color:var\\(--ink\\)/.test(html), sized: /--type-action-title:\\d+pt/.test(html),
  template: /data-template="1fr \\/ 2fr 1fr"/.test(html), deck: /<main class="ps-deck"/.test(deckHtml(deck)) }));
''')
        self.assertEqual(result['drawn'], result['nodes'])
        self.assertEqual(result['distinct'], result['nodes'])
        self.assertGreaterEqual(result['grids'], 3)
        self.assertGreaterEqual(result['components'], 4)
        for key in ('tokens', 'sized', 'template', 'deck'):
            self.assertTrue(result[key], key)

    def test_the_emitter_is_deterministic(self):
        result = run_node(COMPOSE % 'house-style' + '''
console.log(JSON.stringify({ same: deckHtml(deck) === deckHtml(structuredClone(deck)) }));
''')
        self.assertTrue(result['same'])


@requires_chromium
class BrowserParityTests(unittest.TestCase):
    def test_a_browser_sets_every_primitive_where_the_scene_has_it(self):
        result = run_node(COMPOSE % 'gallery-acceptance' + '''
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)(createRequire(import.meta.url).resolve('playwright', { paths: [process.env.RUNTIME_NODE_MODULES] }));
const htmlPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-html-')), 'deck.html');
fs.writeFileSync(htmlPath, deckHtml(deck, { actual: true }));
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSER_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSER_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(htmlPath).href);
const boxes = await page.evaluate(() => [...document.querySelectorAll('.ps-slide')].map((slide) => { const o = slide.getBoundingClientRect();
  return Object.fromEntries([...slide.querySelectorAll('[data-node-id]')].map((el) => { const r = el.closest('.ps-node').getBoundingClientRect(); return [el.dataset.nodeId, [r.x - o.x, r.y - o.y, r.width, r.height]]; })); }));
const wide = await page.evaluate(() => [...document.querySelectorAll('.ps-text')].filter((el) => el.firstElementChild.getBoundingClientRect().width > el.getBoundingClientRect().width + 12).length);
await browser.close();
fs.rmSync(path.dirname(htmlPath), { recursive: true, force: true });
let worst = 0, missing = 0, checked = 0;
deck.slides.forEach((slide, s) => slide.nodes.forEach((node) => {
  const got = boxes[s][node.id];
  if (!got) { missing += 1; return; }
  if (node.style?.rotate) return;
  checked += 1;
  const f = node.frame, hairline = !['text', 'rect', 'ellipse', 'image'].includes(node.type);
  const want = [f.x, f.y, hairline ? Math.max(f.width, 1) : f.width, hairline ? Math.max(f.height, 1) : f.height];
  worst = Math.max(worst, ...want.map((value, i) => Math.abs(value - got[i])));
}));
console.log(JSON.stringify({ checked, missing, worst, wide }));
''')
        self.assertGreater(result['checked'], 4000)
        self.assertEqual(result['missing'], 0)
        self.assertLess(result['worst'], 0.5)
        # The engine's line breaks are the browser's: no text sets wider than the frame it was measured for.
        self.assertEqual(result['wide'], 0)



class GridTemplateTests(unittest.TestCase):
    """A page grid written as CSS grid writes one, inline or by name from the deck's `layouts`."""

    def test_a_dashboard_takes_a_named_template_and_named_areas(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { deckKeyProblems } from './skills/professional-slides/runtime/deck-keys.mjs';
const page = structuredClone(workedExamples().pages.find((p) => p.form === 'dashboard'));
const weighted = compilePage(page, 0).grid;
['hero', 'a', 'b'].forEach((name, i) => { page.exhibits[i].area = name; });
const layouts = { board: { columns: '3fr 2fr', rows: '1fr 1.15fr', areas: ['hero a', 'hero b'] } };
const refused = (grid) => { try { compilePage({ ...page, grid }, 0, { layouts }); return null; } catch (error) { return error.message; } };
console.log(JSON.stringify({ same: JSON.stringify(compilePage({ ...page, grid: 'board' }, 0, { layouts }).grid) === JSON.stringify(weighted),
  inline: JSON.stringify(compilePage({ ...page, grid: layouts.board }, 0).grid) === JSON.stringify(weighted),
  unknown: refused('nope'), fixed: refused({ ...layouts.board, columns: '200px 1fr' }), key: deckKeyProblems({ id: 'd', layouts }) }));
''')
        self.assertTrue(result['same'])
        self.assertTrue(result['inline'])
        self.assertIn('layouts', result['unknown'])
        self.assertIn('fr tracks', result['fixed'])
        self.assertEqual(result['key'], [])

if __name__ == '__main__':
    unittest.main()
