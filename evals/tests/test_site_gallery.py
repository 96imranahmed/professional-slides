"""The published gallery, reproduced, holds still.

Every slide on the public gallery (named in published.json) was rebuilt as a typed
page from its published image (evals/regression/site-gallery/pages). The pages must all compose, and each
component must sit where the approved layout has it: a change to the layout
engine that moves a gallery page shows up here by name, to be looked at - drawn
as approved and as it is now, side by side, by
`node evals/scripts/site_gallery.mjs --sheet` - and then approved
(`node evals/scripts/site_gallery.mjs --approve`, refused until that sheet has
been written for the same moves) or fixed.
"""
import json
import pathlib
import unittest

from node_probe import run_node

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'regression' / 'site-gallery'
SHEET = 'node evals/scripts/site_gallery.mjs --sheet'


class SiteGalleryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node('''
import fs from 'node:fs';
import { galleryLayout, moved } from './evals/scripts/site_gallery.mjs';
const now = await galleryLayout();
const approved = JSON.parse(fs.readFileSync('./evals/regression/site-gallery/layout.json', 'utf8'));
console.log(JSON.stringify({ pages: now.pages, blocking: now.blocking, moved: moved(approved, now.layout), drawn: Object.keys(now.layout) }));
''')

    def test_every_published_slide_has_a_reproduced_page(self):
        listed = json.loads((ROOT / 'published.json').read_text())
        published, waived = set(listed['published']), set(listed['notReproduced'])
        self.assertEqual(published - set(self.result['pages']) - waived, set())

    def test_every_page_composes(self):
        self.assertEqual(self.result['blocking'], [])
        self.assertEqual(set(self.result['pages']) - set(self.result['drawn']), set())

    def test_no_page_has_moved_from_its_approved_layout(self):
        self.assertEqual(self.result['moved'], [], (
            f"{len(self.result['moved'])} gallery page(s) moved. Draw them as approved and as they are now with "
            f"`{SHEET}` (sheets in output/site-gallery/review/), look, then fix the runtime or record the layout "
            "with `node evals/scripts/site_gallery.mjs --approve`."))


class MoveDescriptionTests(unittest.TestCase):
    """What a sheet says moved, and the fingerprint --approve checks a sheet against."""

    @classmethod
    def setUpClass(cls):
        cls.result = run_node('''
import { describeMove, movesHash } from './evals/scripts/site_gallery.mjs';
const approved = { a: [['slide-chrome', 0, 0, 1280, 720], ['section', 60, 140, 602, 528], ['paragraph', 60, 140, 602, 60]], b: [['section', 0, 0, 10, 10]] };
const now = { a: [['slide-chrome', 0, 0, 1280, 720], ['section', 60, 140, 338, 528], ['paragraph', 60, 141, 602, 60], ['paragraph', 60, 220, 338, 80]], b: [['section', 0, 0, 10, 10]], c: [['section', 0, 0, 10, 10]] };
const later = { ...now, a: now.a.map((frame, at) => (at === 1 ? ['section', 60, 140, 300, 528] : frame)) };
console.log(JSON.stringify({ a: describeMove(approved.a, now.a), c: describeMove(undefined, now.c), still: describeMove(approved.b, now.b),
  hash: movesHash(approved, now), same: movesHash(approved, structuredClone(now)), changed: movesHash(approved, later), none: movesHash(approved, approved) }));
''')

    def test_names_each_moved_frame_with_its_delta(self):
        move = self.result['a']
        self.assertEqual(move['summary'], '1 of 3 components moved (section), by up to 264px; components 3 -> 4')
        self.assertEqual(move['lines'], ['#2 section  60,140 602x528 -> 60,140 338x528  (w -264)', '#4 paragraph 60,220 338x80 is new'])
        self.assertEqual(move['before'], [[2, 'section', 60, 140, 602, 528]])
        self.assertEqual(move['after'], [[2, 'section', 60, 140, 338, 528], [4, 'paragraph', 60, 220, 338, 80]])

    def test_a_new_page_and_a_still_one(self):
        self.assertIn('new page', self.result['c']['summary'])
        self.assertEqual(self.result['still']['lines'], [])

    def test_the_fingerprint_follows_the_moves(self):
        self.assertEqual(self.result['hash'], self.result['same'])
        self.assertNotEqual(self.result['hash'], self.result['changed'])
        self.assertNotEqual(self.result['hash'], self.result['none'])


if __name__ == '__main__':
    unittest.main()
