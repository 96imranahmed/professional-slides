"""The published gallery, reproduced, holds still.

Every slide on the public gallery (named in published.json) was rebuilt as a typed
page from its published image (evals/regression/site-gallery/pages). The pages must all compose, and each
component must sit where the approved layout has it: a change to the layout
engine that moves a gallery page shows up here by name, to be looked at beside
the published image and approved (`node evals/scripts/site_gallery.mjs --approve`)
or fixed.
"""
import json
import pathlib
import unittest

from node_probe import run_node

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'regression' / 'site-gallery'


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
        self.assertEqual(self.result['moved'], [])


if __name__ == '__main__':
    unittest.main()
