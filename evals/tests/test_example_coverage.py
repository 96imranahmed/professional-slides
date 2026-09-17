"""Every registered exhibit appears on a page somewhere.

The registry had grown 89 components and 26 chart types while the example decks
exercised a subset of them; five components and six chart types had no page in
any deck, so nothing but a unit test ever composed, measured, emitted and gated
them. The gallery deck is the coverage, and this test is what keeps it honest:
a new component with no page in an example deck fails here.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"

# Components the composer places itself - page furniture, not exhibits an
# author reaches for. Each is covered by the chrome and section tests instead.
FURNITURE = {
    "slide-chrome", "section", "section-heading", "section-title", "section-divider",
    "section-boundary", "page-number", "page-template", "footnote", "connector",
    "content-rail", "tracker-page", "tracker-label", "action-title", "chart-title",
    "chart-callout", "chart-group", "legend", "bullet-list", "paragraph", "metric",
    "insight", "panel", "image-frame", "cover", "divider", "statement", "takeaways",
    "agenda", "callout", "table", "rows", "evidence-note", "insight-tree-table",
    "comparison-table", "logo-collage", "icon-trends", "quote-cluster",
}


def deck_text():
    return "\n".join(path.read_text(encoding="utf-8") for path in sorted(EXAMPLES.glob("*.deck.json")))


class ExampleCoverageTests(unittest.TestCase):
    def test_every_exhibit_component_has_a_page(self):
        registered = run_node('''
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
console.log(JSON.stringify({ids:[...registry.keys()].sort()}));
''')["ids"]
        decks = deck_text()
        missing = [component for component in registered
                   if component not in FURNITURE and f'"{component}"' not in decks]
        self.assertFalse(missing, "no example deck exercises: " + ", ".join(missing))

    def test_every_chart_type_has_a_page(self):
        registered = run_node('''
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
console.log(JSON.stringify({ids:[...registry.keys()].filter((k)=>k.startsWith('chart.')).sort()}));
''')["ids"]
        decks = deck_text()
        missing = [chart for chart in registered if f'"{chart}"' not in decks]
        self.assertFalse(missing, "no example deck plots: " + ", ".join(missing))
        self.assertGreaterEqual(len(registered), 26)

    def test_every_example_deck_composes(self):
        # Composition only - the render is the slow suite's job - but a deck
        # that no longer plans is a deck nobody would notice was broken.
        names = sorted(path.name for path in EXAMPLES.glob("*.deck.json"))
        self.assertTrue(names)
        result = run_node('''
import {readdirSync} from 'node:fs';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {readFileSync} from 'node:fs';
const dir='./skills/professional-slides/examples';
const out={};
for(const name of readdirSync(dir).filter((n)=>n.endsWith('.deck.json'))){
  const plan=toDeckPlan(JSON.parse(readFileSync(`${dir}/${name}`,'utf8')),dir);
  out[name]=plan.slides.length;
}
console.log(JSON.stringify({decks:out}));
''')
        self.assertEqual(sorted(result["decks"]), names)
        for name, pages in result["decks"].items():
            self.assertGreater(pages, 0, name)


if __name__ == "__main__":
    unittest.main()
