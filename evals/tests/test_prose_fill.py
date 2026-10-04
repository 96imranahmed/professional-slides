"""A column of prose is measured at the size it is drawn at, and its finding says the length that fills it.

An appendix memo took seven runs to find a length that filled its column: 265
words left a band empty and 305 split into two short columns. The composer
sized the column by measuring the prose at the deck's type size, and an
appendix page is drawn a step smaller - so the column it chose never reached
the foot, at any length under the page's word ceiling. The prose is now
measured at the page's own density (an appendix page's, or the deck's), and a
page of prose beside its panel that stands part empty or runs past its ceiling
is told the words of prose that fill the column it is set in, read off the
same measurement. These tests hold that the stated range, when met, composes
with neither finding, and that the turn from one column to two never leaves a
blocking void.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

MEMO = '''
import { authorDeck, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
const worked = workedExamples();
const memo = worked.pages.find((p) => p.type === 'argument' && p.form === 'memo');
const WORDS = memo.paragraphs.join(' ').split(/\\s+/);
// The worked memo's own prose run to `n` words, in four paragraphs.
const prose = (n) => { const words = Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]); const per = Math.ceil(n / 4);
  return [0, 1, 2, 3].map((k) => words.slice(k * per, (k + 1) * per).join(' ').replace(/[.,]?$/, '.')).filter((text) => text.length > 1); };
const filler = worked.pages.filter((p) => p.type && p.id !== memo.id).slice(0, 2);
// The memo as the only page of the body, or in the appendix behind two body pages; `density` is the deck's.
const run = async (n, { appendix = false, density } = {}) => { const page = { ...memo, id: 'm1', paragraphs: prose(n) };
  const doc = { deck: { ...worked.deck, ...(density ? { density } : {}) }, pages: appendix ? filler : [page], ...(appendix ? { appendix: [page] } : {}) };
  const result = await authorDeck(doc, { baseDir: '.', fit: false });
  const columns = new Set(JSON.stringify(result.deck.slides.find((s) => (s.sourceSlideId ?? s.id) === 'm1')?.nodes ?? '').match(/m1-doc-\\d+/g) ?? []).size;
  return { columns, findings: [...result.blocking, ...result.advisories].filter((f) => String(f.id) === 'm1' && ['SCENE_VOID', 'WORDS', 'PAGE_DOES_NOT_COMPOSE'].includes(f.code)).map((f) => ({ code: f.code, severity: f.severity, fills: f.fills ?? null, repair: f.repair })) }; };
const SETTINGS = [{}, { appendix: true }, { density: 'pre-read' }];
'''


class ProseFillTests(unittest.TestCase):
    def test_the_stated_range_when_met_composes_without_a_void_or_a_word_finding(self):
        result = run_node(MEMO + '''
const out = [];
for (const setting of SETTINGS) {
  const short = await run(100, setting), long = await run(340, setting);
  const stated = short.findings.find((f) => f.code === 'SCENE_VOID')?.fills ?? null;
  const at = stated ? await Promise.all([stated.min, Math.round((stated.min + stated.max) / 2), stated.max].map(async (n) => [n, (await run(n, setting)).findings.map((f) => f.code)])) : null;
  out.push({ setting, short: short.findings.map((f) => [f.code, f.severity]), long: long.findings.map((f) => [f.code, f.severity, f.fills]), stated, repair: short.findings[0]?.repair ?? null, at });
}
console.log(JSON.stringify(out));
''')
        for case in result:
            with self.subTest(setting=case["setting"]):
                self.assertEqual(case["short"], [["SCENE_VOID", "blocker"]])
                stated = case["stated"]
                self.assertIsNotNone(stated)
                self.assertEqual(stated["prose"], 100)
                self.assertLess(100, stated["min"])
                self.assertLess(stated["min"], stated["max"])
                # The finding says the range, with the words the prose runs to.
                self.assertIn(f"{stated['min']} to {stated['max']} words of prose fill the column it is set in", case["repair"])
                self.assertIn("the prose runs to 100", case["repair"])
                # Written to the range - at its ends and its middle - the page has neither finding.
                self.assertEqual([codes for _, codes in case["at"]], [[], [], []], case["at"])
                # Past the ceiling the same range is stated on the word finding.
                self.assertEqual([f[:2] for f in case["long"] if f[0] == "WORDS"], [["WORDS", "blocker"]])
                self.assertEqual([f[2]["max"] for f in case["long"] if f[0] == "WORDS"], [stated["max"]])

    def test_an_appendix_memo_is_measured_at_the_size_it_is_drawn_at(self):
        # The run's own lengths. Measured at the body's type size, 265 words in the appendix left a band empty and no
        # length under the word ceiling filled the column; drawn a step smaller, the appendix column takes more words.
        result = run_node(MEMO + '''
const body = await run(100), appendix = await run(100, { appendix: true });
console.log(JSON.stringify({ at265: (await run(265, { appendix: true })).findings.map((f) => f.code), body: body.findings[0].fills, appendix: appendix.findings[0].fills }));
''')
        self.assertEqual(result["at265"], [])
        self.assertGreater(result["appendix"]["min"], result["body"]["min"])

    def test_the_turn_from_one_column_to_two_never_leaves_a_blocking_void(self):
        # Every length from the first that fills to well past the ceiling: a few words either side of the turn change
        # which layout is drawn, not whether it fills.
        result = run_node(MEMO + '''
const out = [];
for (const setting of SETTINGS) {
  const first = (await run(100, setting)).findings.find((f) => f.code === 'SCENE_VOID').fills.min;
  const rows = [];
  for (let n = first; n <= 372; n += 12) { const r = await run(n, setting); rows.push([n, r.columns, r.findings.filter((f) => f.severity === 'blocker' && f.code !== 'WORDS').map((f) => f.code)]); }
  out.push({ setting, turn: rows.find(([, columns]) => columns === 2)?.[0] ?? null, columns: [...new Set(rows.map(([, columns]) => columns))], voids: rows.filter(([, , codes]) => codes.length) });
}
console.log(JSON.stringify(out));
''')
        for case in result:
            with self.subTest(setting=case["setting"]):
                self.assertEqual(case["voids"], [])
                self.assertIn(1, case["columns"])


if __name__ == "__main__":
    unittest.main()
