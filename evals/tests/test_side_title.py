"""The title down a side panel, and the section tabs down the right margin.

A strong deck sometimes sets the title in a dark column at the left, its
finding's figure large over it, with the exhibit beside it; and a long deck
runs its sections as tabs down the page's edge. Every design fixed the title
band at the top, and every tracker in it.
"""
from __future__ import annotations

import sys
import unittest

from node_probe import ROOT, run_node

sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import render_gates  # noqa: E402
from gate_config import THRESHOLDS  # noqa: E402

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { SIDE_TITLE } from './skills/professional-slides/runtime/registry-chrome.mjs';
import { SIDE_RAIL } from './skills/professional-slides/runtime/trackers.mjs';
import { CHROME, SLIDE } from './skills/professional-slides/runtime/core.mjs';
import { sceneCollisions } from './skills/professional-slides/runtime/validate-overlap.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const page = { id: 's', type: 'ranking', form: 'bar', commentary: 'on-exhibit', takeaway: false, titlePlacement: 'side', titleNumeral: '47%',
  why: 'The board sees how far Northvale off-peak trains run below its peers', settles: { kind: 'rank', what: 'off-peak seats filled on eight operators, FY26' },
  adds: 'The median line says how far below the field Northvale sits',
  title: 'Northvale fills 47% of its off-peak seats, the fewest of the eight operators', subtitle: 'Off-peak load factor, share of seats filled, FY26',
  exhibit: { heading: 'Off-peak seats filled, FY26', unit: '%', categories: ['Westmoor', 'Kingsway', 'Eastbrook', 'Southfield', 'Coastline', 'Dalesway', 'Valley Rail', 'Northvale'],
    series: [{ name: 'Load factor', values: [68, 64, 61, 58, 55, 53, 50, 47] }], highlights: [{ category: 'Northvale' }], referenceLines: [{ value: 57, label: 'Median 57%' }] },
  source: 'Source: illustrative load data; synthetic' };
const scene = (slides, extra = {}) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', ...extra, slides }, '.').deck.slides;
"""


class SideTitleTests(unittest.TestCase):
    def test_the_title_takes_a_panel_and_the_body_the_rest(self):
        run_node(PRELUDE + """
const [slide] = scene([compilePage(page)]);
const panel = slide.nodes.find((n) => n.data?.titlePlacement === 'side' && n.role === 'title-band');
const title = slide.nodes.find((n) => n.role === 'action-title'), numeral = slide.nodes.find((n) => n.role === 'title-numeral');
assert.equal(panel.frame.width, SIDE_TITLE.panel);
assert.ok(title.frame.x + title.frame.width <= SIDE_TITLE.panel, 'the title sits in its panel');
assert.ok(numeral.frame.y < title.frame.y, 'the figure stands over the title');
assert.equal(numeral.style.fontFamily.tokenId, 'font.body', 'figures are set in the body face, whose digits are lining');
assert.equal(title.data.titlePlacement, 'side');
const body = slide.nodes.filter((n) => n.role === 'chart-mark');
assert.ok(Math.min(...body.map((n) => n.frame.x)) >= SIDE_TITLE.panel + SIDE_TITLE.gap, 'the body starts beside the panel');
assert.ok(Math.min(...slide.nodes.filter((n) => n.data?.componentInstance?.includes('exhibit')).map((n) => n.frame.y)) < CHROME.bodyTop, 'and from the title top, not under a title band');
assert.ok(panel.frame.y + panel.frame.height <= CHROME.sourceTop, 'the panel stops above the source line');
assert.deepEqual(sceneCollisions(slide).filter((f) => f.code === 'TEXT_ON_TEXT'), []);
console.log('{}');
""")

    def test_a_side_title_takes_one_exhibit_and_no_commentary_column(self):
        run_node(PRELUDE + """
assert.match(error(() => compilePage({ ...page, commentary: 'beside', adds: 'x', points: [{ lead: 'a', text: 'Northvale fills fewer seats than any peer.' }, { lead: 'b', text: 'The median sits ten points higher.' }] })), /a side title takes a third of the page's width/);
assert.match(error(() => compilePage({ ...page, titlePlacement: 'left' })), /"top" \\(the default\\) or "side"/);
assert.match(error(() => compilePage({ ...page, titlePlacement: undefined })), /needs `titlePlacement: "side"`/);
assert.match(error(() => compilePage({ ...page, titleNumeral: 'Fewest seats filled' })), /the finding's figure/);
console.log('{}');
""")

    def test_the_line_gate_reads_a_side_title_against_its_panel(self):
        def slide(placement, lines):
            node = {"type": "text", "role": "action-title", "text": "\n".join(["word"] * lines),
                    "data": {"textLayout": {"lines": ["word"] * lines}, **({"titlePlacement": placement} if placement else {})}}
            return {"nodes": [node]}
        for placement, lines, flagged in ((None, 3, True), ("side", 5, False), ("side", THRESHOLDS["side_title_lines_max"] + 1, True)):
            findings = []
            render_gates.gate_title(1, slide(placement, lines), findings)
            self.assertEqual(any(f["code"] == "TITLE_LINES" for f in findings), flagged, (placement, lines))
        out = run_node("""
import { SIDE_TITLE } from './skills/professional-slides/runtime/registry-chrome.mjs';
console.log(JSON.stringify({ lines: SIDE_TITLE.lines }));
""")
        self.assertEqual(out["lines"], THRESHOLDS["side_title_lines_max"], "the chrome and the gate hold one number")


class SideRailTests(unittest.TestCase):
    def test_the_sections_run_down_the_right_margin(self):
        run_node(PRELUDE + """
const { titlePlacement, titleNumeral, ...top } = page;
const slides = [{ kind: 'section', title: 'Where ridership stands' }, compilePage({ ...top, commentary: 'on-exhibit' }), { kind: 'section', title: 'What passengers want' }, { kind: 'section', title: 'The plan' }];
const deck = scene(slides, { tracker: 'side-rail' });
const analytical = deck.find((s) => s.nodes.some((n) => n.role === 'chart-mark'));
const tabs = analytical.nodes.filter((n) => n.role === 'tracker-rail-tab'), labels = analytical.nodes.filter((n) => n.role === 'tracker-rail-label');
assert.equal(tabs.length, 3);
assert.ok(tabs.every((t) => t.frame.x >= SLIDE.width - CHROME.right && t.frame.x + t.frame.width <= SLIDE.width), 'the rail stays in the right margin');
assert.ok(labels.every((l) => l.style.rotate === 90), 'the names read down the tabs');
assert.deepEqual(tabs.map((t) => t.data.selected), [true, false, false]);
const body = analytical.nodes.filter((n) => n.role === 'chart-mark');
assert.ok(Math.max(...body.map((n) => n.frame.x + n.frame.width)) <= SLIDE.width - CHROME.right, 'the body keeps its width');
const long = [{ kind: 'section', title: 'Where ridership stands today across all of the network' }, compilePage({ ...top, commentary: 'on-exhibit' }), ...[2, 3, 4, 5, 6, 7].map((n) => ({ kind: 'section', title: `Section number ${n} of the plan` }))];
assert.match(error(() => scene(long, { tracker: 'side-rail' })), /Side rail tab .* holds two/);
// Two sections are a pair of tabs, not a position: refused for the deck, with the trackers that take two named.
const two = [slides[0], slides[1], slides[2]];
assert.match(error(() => scene(two, { tracker: 'side-rail' })), /A side-rail tracker needs three sections; use tracker: "pills" or "label" for two/);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
