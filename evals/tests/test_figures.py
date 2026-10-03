"""Figures (runtime/figures.mjs): flows, fact grids and side statements.

A flow fills its frame from the top with no label struck by its arrow; a fact
grid draws its facts across and never stretches a tile; a side statement keeps
its highlighted phrase legible on a dark ground.
"""
import unittest

from node_probe import run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
RUNTIME = "./skills/professional-slides/runtime"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S, adds: 'The commentary names the mechanism the exhibit cannot show' };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
// The emphasised text of a composed page, runs joined across line breaks.
const lit = (slide) => slide.nodes.map((n) => (n.runs || []).map((r) => (r.text === '\\n' ? ' ' : r.accent || r.bold ? r.text.replace(/\\n/g, ' ') : ' | ')).join('')).join(' | ');
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const regions = ['Europe', 'East Asia & Australasia', 'Americas', 'West Asia & Indian Ocean', 'Africa', 'Middle East'];
"""


class FlowTests(unittest.TestCase):
    def test_a_flow_starts_at_the_top_of_its_frame_and_grows_to_fill_it(self):
        """Fifty-page audit: flows floated in their frames and arrows ran through their labels."""
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
const props = {{ nodes: [{{ id: 'a', label: 'Customer sale', text: '$100 billed' }}, {{ id: 'b', label: 'Gross basis', text: '$100 revenue' }},
  {{ id: 'c', label: 'Net basis', text: '$85 revenue' }}, {{ id: 'd', label: 'Pre-compute cash', text: '$85 either way' }}],
  edges: [{{ from: 'a', to: 'b', label: 'principal role' }}, {{ from: 'a', to: 'c', label: 'agent role' }}, {{ from: 'b', to: 'd' }}, {{ from: 'c', to: 'd' }}] }};
const frame = {{ x: 60, y: 150, width: 780, height: 470 }};
const nodes = REGISTRY.get('flow').render({{ id: 'f', frame, props }}).nodes;
const steps = nodes.filter((n) => n.role === 'flow-step').map((n) => n.frame);
const arrows = nodes.filter((n) => n.role === 'flow-arrow').map((n) => n.data);
const labels = nodes.filter((n) => n.role === 'flow-arrow-label').map((n) => n.frame);
const natural = REGISTRY.get('flow').measureContent({{ frame, props }}).natural;
const crosses = (b, l) => {{ for (let i = 0; i <= 200; i++) {{ const x = l.x1 + (l.x2 - l.x1) * i / 200, y = l.y1 + (l.y2 - l.y1) * i / 200;
  if (x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height) return true; }} return false; }};
const meets = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
console.log(JSON.stringify({{ top: Math.min(...steps.map((s) => s.y)), bottom: Math.max(...steps.map((s) => s.y + s.height)), natural,
  struck: labels.some((b) => arrows.some((l) => crosses(b, l))), onStep: labels.some((b) => steps.some((s) => meets(b, s))),
  apart: !meets(labels[0], labels[1]) }}));
""")
        self.assertEqual(result["top"], 150)
        # Two rows of steps take most of a 470px frame, not a strip of it.
        self.assertGreater(result["bottom"] - 150, 0.7 * 470)
        self.assertFalse(result["struck"], "an arrow runs through its label")
        self.assertFalse(result["onStep"], "a label touches a step")
        self.assertTrue(result["apart"])


class FactGridTileTests(unittest.TestCase):
    def test_a_one_column_fact_grid_needs_its_sentences_and_never_stretches(self):
        """Fifty-page audit: one-column fact grids of 1160px tiles."""
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ compilePage }} from '{KIT}';
{PAGE}
const grid = REGISTRY.get('fact-grid');
const frame = {{ x: 0, y: 0, width: 1160, height: 440 }};
const items = [{{ value: '25.8%', label: 'Jan cohort retained' }}, {{ value: '45%', label: 'Feb cohort retained' }}, {{ value: '14pp', label: 'Gap to the leader' }}];
const told = items.map((item) => ({{ ...item, text: 'A sentence that says what the figure counts and why it matters here' }}));
const tiles = grid.render({{ id: 'g', frame, props: {{ items: told, columns: 1 }} }}).nodes.filter((n) => n.role === 'fact-tile');
const across = grid.render({{ id: 'g', frame, props: {{ items }} }}).nodes.filter((n) => n.role === 'fact-tile');
const value = grid.render({{ id: 'g', frame, props: {{ items }} }}).nodes.find((n) => n.role === 'fact-value');
const bare = grid.render({{ id: 'g', frame, props: {{ items, columns: 1 }} }}).nodes.filter((n) => n.role === 'fact-tile');
const page = (exhibit) => ({{ ...base, id: 'p1', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Three facts set the scale of the business', exhibit }});
console.log(JSON.stringify({{ compiled: error(() => compilePage(page({{ items, columns: 1 }}))), toldCompiles: error(() => compilePage(page({{ items: told, columns: 1 }}))),
  bare: new Set(bare.map((t) => t.frame.y)).size,
  told: Math.max(...tiles.map((t) => t.frame.y + t.frame.height)), across: across.length && new Set(across.map((t) => t.frame.y)).size, face: value.style.fontFamily.tokenId }}));
""")
        self.assertIn("give every tile its sentence", result["compiled"])
        self.assertNotIn("give every tile its sentence", result["toldCompiles"] or "")
        self.assertEqual(result["bare"], 1, "a one-column grid compiled before the refusal draws its facts across")
        self.assertLess(result["told"], 440, "a one-column grid keeps its natural height")
        self.assertEqual(result["across"], 1)
        self.assertEqual(result["face"], "font.body", "figures are set in the body face, whose digits line up")


class SideStatementTests(unittest.TestCase):
    def test_a_dark_rail_where_the_accent_does_not_read_sets_the_phrase_bold(self):
        """Fifty-six-page re-author: on a dark rail the accent did not read, so the phrase is set bold."""
        result = run_node(PRELUDE + """
import { sideStatementNodes } from './skills/professional-slides/runtime/figures.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const frame = { x: 0, y: 0, width: 380, height: 500 };
const text = 'Faster growth is not a larger hub yet: the hub still handled 95.2m against 54.3m.';
const node = (tone) => sideStatementNodes({ id: 'r', frame, props: { text, tone, highlight: ['95.2m against 54.3m'] } }).find((n) => n.role === 'side-panel-text');
const dark = node('dark'), tint = node('tint');
console.log(JSON.stringify({ darkBold: dark.style.bold, darkRuns: dark.runs, tintRuns: tint.runs }));
""")
        runs = result["darkRuns"]
        phrase = [r for r in runs if "95.2m" in r["text"]]
        self.assertTrue(phrase and all(r["bold"] for r in phrase))
        # Either the accent reads on the fill, or the sentence drops to regular
        # weight so the bold phrase stands out.
        self.assertTrue(any(r.get("accent") for r in runs) or (result["darkBold"] is False and not all(r["bold"] for r in runs)))
        self.assertTrue(any((r.get("accent") or r["bold"]) and "95.2m" in r["text"] for r in result["tintRuns"]))


if __name__ == "__main__":
    unittest.main()
