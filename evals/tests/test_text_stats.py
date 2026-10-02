"""One definition of a word, and of a content word, in Python and in Node.

The composer writes each page's body words on the scene (`planBodyWords`,
text-contract.mjs `textWords`) and the page gates read that number, falling
back to their own count for a scene without it. Two counters that disagree
about what a word is let a page clear its floor at authoring and miss it at
the build. text_stats.py is the Python side of the one definition; these
tests hold it to the JavaScript over strings chosen to split them: numbers,
units, currency, dashes, bullets, URLs, hyphenated line breaks, every
whitespace JavaScript and Python disagree on, and compatibility forms NFKC
rewrites.
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

from node_probe import ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))

import text_stats  # noqa: E402

CORPUS = [
    "", " ", "\n", "\t \n ", "word", "  two  words  ",
    "Revenue grew 12% to $1.2B in FY24",
    "12.5 m² per head; 3,400 km — up 4.2pp y/y",
    "€1,250.00 (−3.1%) vs. £900k",
    "Q1–Q4 2025: 1.2x, 2.5×, ~40%",
    "state-owned, re-rated and self-\nfunded", "a hyphen at the end-\n  of a line", "an en dash – and an em dash —",
    "— • · ‣ -", "• First point\n• Second point", "1. Numbered\n2) items",
    "https://example.com/a-b?c=1&d=2 and www.site.org", "user@example.com",
    "soft­hyphen and zero​width", "nbsp space", "thin space narrow",
    "line separator paragraph", "bom﻿inside", "ideographic　space",
    "unit\x1cseparators\x1dhere\x1erecord\x1fend", "next\x85line", "vertical\x0btab\x0cfeed",
    "ﬁnancial ﬂows", "ＦＵＬＬ ｗｉｄｔｈ １２３", "x² + y³", "½ of the ⅓",
    "Ⅳ quarter", "café naïve résumé", "Straße", "İstanbul", "ΣΑΣ σας",
    "日本語のテキスト", "emoji 🚀 launch 📈", "tab\tseparated\tvalues",
    "CR\r\nLF line endings\r\n", "trailing hyphen-", "-leading", "--double--",
    "(parenthetical) [bracketed] {braced}", "quotes “curly” and ‘single’ and \"straight\"",
    "don't won’t it's o'clock", "AT&T P&G S&P 500", "COVID-19 H1N1 B2B", "3M 10x 24/7 9-to-5",
    "$", "%", "1", "0.5", "-3", "+4", "1e6", "∞",
    "Interpretation: the table reads the same both ways.",
    "Education does not decide the city; it decides the neighborhood.",
]


class WordParityTests(unittest.TestCase):
    """text_stats.words is text-contract.mjs textWords, token for token."""

    @classmethod
    def setUpClass(cls):
        os.environ["TEXT_STATS_CORPUS"] = json.dumps(CORPUS + [None])
        cls.js = run_node("""
import {normalizeText, textWords} from './skills/professional-slides/runtime/text-contract.mjs';
import {contentWords} from './skills/professional-slides/runtime/gates/content_gates.mjs';
const corpus = JSON.parse(process.env.TEXT_STATS_CORPUS);
console.log(JSON.stringify(corpus.map((text) => ({
  normalized: normalizeText(text),
  count: textWords(text),
  words: normalizeText(text).split(/\\s+/).filter(Boolean),
  content: [...contentWords(text)].sort(),
}))));
""")

    def test_the_corpus_reaches_both_sides(self):
        self.assertEqual(len(self.js), len(CORPUS) + 1)

    def test_normalisation_matches(self):
        for text, js in zip(CORPUS + [None], self.js):
            with self.subTest(text=text):
                self.assertEqual(text_stats.normalize_text(text), js["normalized"])

    def test_words_and_their_count_match(self):
        for text, js in zip(CORPUS + [None], self.js):
            with self.subTest(text=text):
                self.assertEqual(text_stats.words(text), js["words"])
                self.assertEqual(text_stats.word_count(text), js["count"])

    def test_content_words_match(self):
        for text, js in zip(CORPUS + [None], self.js):
            with self.subTest(text=text):
                self.assertEqual(sorted(text_stats.content_words(text)), js["content"])

    def test_the_cases_the_old_counters_split_on(self):
        # Every token is a word, a dash and a bullet included; a line broken at
        # a hyphen is one word; an invisible character is no word at all.
        self.assertEqual(text_stats.word_count("Revenue — up 12%"), 4)
        self.assertEqual(text_stats.word_count("self-\nfunded"), 1)
        self.assertEqual(text_stats.word_count("­ ​"), 0)
        self.assertEqual(text_stats.word_count(None), 0)
        # A printed word carries a letter or a digit: the bullet and the dash
        # pdftotext sets as tokens of their own are not ones.
        self.assertEqual(text_stats.printed_words("• Revenue — up 12%"), ["Revenue", "up", "12%"])


class OneDefinitionTests(unittest.TestCase):
    def test_every_python_reader_uses_the_one_definition(self):
        import density_profile
        import page_gates
        import render_gates
        import scene_gates
        import semantic_gates
        self.assertIs(page_gates.word_count, text_stats.word_count)
        self.assertIs(render_gates.word_count, text_stats.word_count)
        self.assertIs(scene_gates.word_count, text_stats.word_count)
        self.assertIs(semantic_gates.content_words, text_stats.content_words)
        self.assertIs(density_profile.printed_words, text_stats.printed_words)
        self.assertEqual(density_profile.words("• Revenue — up 12%"), 3)

    def test_the_stopwords_live_in_one_file(self):
        lists = json.loads((GATES / "stopwords.json").read_text(encoding="utf-8"))
        self.assertEqual(text_stats.STOPWORDS, frozenset(lists["content"]))
        self.assertEqual(text_stats.TITLE_STOPWORDS, frozenset(lists["title"]))
        self.assertTrue(text_stats.TITLE_STOPWORDS <= text_stats.STOPWORDS)
        # Neither side keeps a copy of the list in its source.
        for path in (GATES / "content_gates.mjs", GATES / "semantic_gates.py", GATES / "scene_gates.py"):
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("however therefore", source, path.name)
            self.assertNotIn("were be been", source, path.name)


if __name__ == "__main__":
    unittest.main()
