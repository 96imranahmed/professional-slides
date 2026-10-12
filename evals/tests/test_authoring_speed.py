"""The authoring loop's hot paths give the same answers, with the repeated work taken out.

A cold `--plan` of a 106-page deck took two and a half minutes: the chart
callouts searched every cell of the plot against every mark before ruling a
cell out on cost (318 searches, half of them repeats), the wrap measured each
growing candidate line in full at every width it was tried at, and the
structure search re-read every page's features on each of its 50,000 readings
of the deck. Each is now done once, and these tests hold that the answers did
not move: a wrap set by adding its words' widths is the wrap measured line by
line, a remembered callout is never one placed in another design's type, and
a plan record is kept only at its own place in the deck.
"""
import unittest

from node_probe import run_node


class WrapTests(unittest.TestCase):
    def test_a_wrap_is_set_by_adding_its_words_widths_and_matches_the_line_by_line_measure(self):
        # The bundled advance tables carry no kerning, so a line's width is its words' and spaces' widths added: the
        # wrap measures each word once, and at a second width measures nothing again.
        result = run_node(r"""
import { measureText } from './skills/professional-slides/runtime/text-layout.mjs';
import { fontContext } from './skills/professional-slides/runtime/font-metrics.mjs';
const ctx = fontContext();
// The wrap as it was: every candidate line measured whole.
const reference = (text, width, { fontFamily, fontSize, bold, wrapWidthRatio = 1 }) => {
  ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize * 96 / 72}px "${fontFamily}"`;
  const w = (s) => ctx.measureText(s).width, lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && w(candidate) > width * wrapWidthRatio) { lines.push(line); line = word; } else line = candidate;
      if (w(line) > width + 0.01) return 'unbreakable';
    }
    lines.push(line);
  }
  return JSON.stringify([lines, Math.max(...lines.map(w))]);
};
const words = 'The North Atlantic earns IAG more per seat than any other long-haul market, and Heathrow carries 85.8% of UK-US passengers; Istanbul grew 24% from 2019 to 2025 against Heathrow\'s 4.4%'.split(' ');
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let differ = 0, cases = 0;
for (let i = 0; i < 600; i += 1) {
  const text = Array.from({ length: 3 + Math.floor(rnd() * 40) }, () => words[Math.floor(rnd() * words.length)]).join(rnd() < 0.2 ? '  ' : ' ') + (rnd() < 0.1 ? '\nA second paragraph' : '');
  const opts = { fontFamily: rnd() < 0.7 ? 'Arial' : 'Georgia', fontSize: [9, 11, 12, 14, 18, 28][Math.floor(rnd() * 6)], bold: rnd() < 0.3, wrapWidthRatio: rnd() < 0.5 ? 1 : 0.97 };
  const width = 30 + rnd() * 700;
  let got;
  try { const m = measureText(text, width, opts); got = JSON.stringify([m.lines, m.width]); } catch { got = 'unbreakable'; }
  cases += 1; if (got !== reference(text, width, opts)) differ += 1;
}
// A paragraph wrapped at a second and third width measures no string again.
const paragraph = Array.from({ length: 120 }, (_, i) => words[i % words.length]).join(' ');
measureText(paragraph, 400, { fontFamily: 'Arial', fontSize: 12 });
const measure = ctx.measureText.bind(ctx); let calls = 0;
ctx.measureText = (s) => { calls += 1; return measure(s); };
measureText(paragraph, 310, { fontFamily: 'Arial', fontSize: 12 });
measureText(paragraph, 520, { fontFamily: 'Arial', fontSize: 12 });
ctx.measureText = measure;
console.log(JSON.stringify({ cases, differ, backend: ctx.backend, calls }));
""")
        self.assertEqual(result["differ"], 0, result)
        if result["backend"] == "table":
            self.assertEqual(result["calls"], 0, "a wrap at another width measures nothing it has measured")

    def test_normalised_text_and_word_counts_read_the_same_however_often_they_are_asked(self):
        result = run_node(r"""
import { normalizeText, textWords } from './skills/professional-slides/runtime/text-contract.mjs';
const samples = ['  Heathrow­ carries  85.8%\nof UK-US ', 'co-\n operation', '', null, undefined, 42];
const once = samples.map((s) => [normalizeText(s), textWords(s)]);
const again = samples.map((s) => [normalizeText(s), textWords(s)]);
console.log(JSON.stringify({ once, again }));
""")
        self.assertEqual(result["once"], result["again"])
        self.assertEqual(result["once"][0], ["Heathrow carries 85.8% of UK-US", 5])
        self.assertEqual(result["once"][3], ["", 0])


class CalloutTests(unittest.TestCase):
    def test_a_callout_placed_in_one_design_is_not_reused_in_another(self):
        # The open-space search is remembered by what it is given - the note, the marks and labels it avoids, the room, and
        # the box the note measures to in the deck's type - so the same chart in a larger type places its own, larger box,
        # and in the same type finds the same place again.
        result = run_node(r"""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { TOKENS, resolveDensityTokens } from './skills/professional-slides/runtime/core.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const rooms = [['Haunted Hairdresser', 12, 2.9], ['Quantum Cupboard', 18, 3.2], ['Vault of Mild Peril', 33, 4.0], ['Clockwork Library', 41, 4.3],
  ['Detective Duck', 46, 4.55], ['Moon Base Mishap', 51, 4.65], ['The Missing Llama', 55, 4.75], ['Midnight Bakery', 63, 4.5], ['Lost Sock Drawer', 85, 3.8]];
const props = { heading: 'Escape rate against review score', xLabel: 'Teams escaping, %', yLabel: 'Review, stars', xMin: 0, xMax: 100, yMin: 2.5, yMax: 5,
  points: rooms.map(([name, x, y]) => ({ name, x, y })), dataLabels: false, annotations: [{ category: 'The Missing Llama', text: 'Best in the chain: 55% escape, 4.8 stars' }] };
const box = () => REGISTRY.get('chart.scatter').render({ id: 'c', frame: { x: 60, y: 130, width: 1160, height: 540 }, props }).nodes.find((n) => n.role === 'annotation-surface');
const small = box();
const large = withDesignTokens(resolveDensityTokens(TOKENS, 'live-pitch'), box);
const largeAgain = withDesignTokens(resolveDensityTokens(TOKENS, 'live-pitch'), box);
console.log(JSON.stringify({ small: small.frame, large: large.frame, largeAgain: largeAgain.frame, at: [small.data.evidencePlacement, large.data.evidencePlacement] }));
""")
        self.assertNotEqual([result["small"]["width"], result["small"]["height"]], [result["large"]["width"], result["large"]["height"]],
                            "the larger type sets a larger box")
        self.assertEqual(result["large"], result["largeAgain"], "the same chart in the same type finds the same place")


class StructureSearchTests(unittest.TestCase):
    def test_a_plan_record_is_kept_only_at_its_own_place(self):
        # Within a structure search a page object reads as the record it read as before - but only where it stands at
        # the same place: moved, it is read again with its new number.
        result = run_node(r"""
import { planOf } from './skills/professional-slides/runtime/author-deck.mjs';
const page = (id) => ({ id, title: `Page ${id}`, pageType: { type: 'ranking', form: 'bar', commentary: 'beside', why: 'w' }, exhibit: { type: 'chart.bar' } });
const a = page('a'), b = page('b'), c = page('c');
const records = new WeakMap();
const first = planOf({ id: 'd', slides: [a, b, c] }, { records });
const same = planOf({ id: 'd', slides: [a, b, c] }, { records });
const moved = planOf({ id: 'd', slides: [b, a, c] }, { records });
const plain = planOf({ id: 'd', slides: [b, a, c] });
console.log(JSON.stringify({ reused: first.pages[0] === same.pages[0], moved: moved.pages.map((p) => [p.id, p.n]), plain: plain.pages.map((p) => [p.id, p.n]), equal: JSON.stringify(moved) === JSON.stringify(plain) }));
""")
        self.assertTrue(result["reused"])
        self.assertEqual(result["moved"], [["b", 1], ["a", 2], ["c", 3]])
        self.assertTrue(result["equal"], "a remembered plan reads as a fresh one")


if __name__ == "__main__":
    unittest.main()
