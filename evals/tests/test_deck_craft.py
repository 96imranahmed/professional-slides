"""What a deck does, page after page — and the stage that had no consequence.

Two things landed together here.

`DECK_CRAFT` measures three rates over a deck's own pages against 122 pages of
real client-project work: a phrase emphasised (client 0.51), a source line
(0.67), and drawn elements a page (corpus median 32). None of the three was
measured anywhere, and our own example decks ran 0.05 to 0.22 on the first.

The reason they ran that low is the second thing. `highlight` — "the phrase the
reader should see first" — existed on a point and on a table cell and nowhere
else, while the content stage recorded exactly one per page and the build gated
the file and threw it away. The stage was a checkpoint with no consequence. Now
the page's highlight reaches whatever carries the page's prose, and a phrase the
page does not say is simply not emphasised rather than being an error.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"
BUILD = ROOT / "skills" / "professional-slides" / "runtime" / "build-deck.mjs"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


def text(role, value, **over):
    return dict({"type": "text", "role": role, "text": value}, **over)


def page(n, *, highlight=False, source=True, marks=14, annotated=True, bridge=None):
    nodes = [text("action-title", f"Page {n} states a finding worth reading"),
             text("list-item", "The second wave opens on a gate rather than on a date",
                  **({"runs": [{"text": "The second wave opens on ", "bold": False},
                               {"text": "a gate", "bold": True, "accent": True},
                               {"text": " rather than on a date", "bold": False}]} if highlight else {}))]
    if source:
        nodes.append(text("source-text", "Source: engagement analysis, 2026"))
    for index in range(marks):
        nodes.append({"type": "rect", "role": "chart-mark",
                      **({"data": {"highlighted": True}} if annotated and index == 0 else {})})
    if bridge:
        # What the composer emits for `implication`: the gutter node carries the
        # variant it drew, and its id names the page's implication.
        nodes.append({"type": "line", "role": "relationship-divider",
                      "id": f"s{n:02d}-implication:rule-top",
                      "data": {"relation": "implies" if bridge == "divider-chevron" else "adjacent"}})
        nodes.append({"type": "ellipse", "role": "relationship-disc",
                      "id": f"s{n:02d}-implication:disc",
                      "data": {"relation": "implies", "arrowVariant": bridge}})
    return {"id": f"s{n:02d}", "componentInstances": [{"id": "chrome", "component": "slide-chrome"},
                                                      {"id": f"s{n:02d}-0", "component": "chart.column"}],
            "nodes": nodes}


def deck(slides):
    return {"slides": slides}


def craft(slides):
    findings = []
    page_gates.gate_deck_craft(slides, list(range(len(slides))), findings)
    return findings


class DeckCraftTests(unittest.TestCase):
    def test_a_deck_that_never_emphasises_a_phrase_is_reported(self):
        findings = craft([page(i) for i in range(1, 9)])
        self.assertEqual([f["code"] for f in findings], ["DECK_CRAFT"])
        self.assertEqual(findings[0]["measured"]["highlight"], 0.0)
        self.assertIn("strong decks", findings[0]["repair"])

    def test_a_deck_that_works_its_pages_passes(self):
        self.assertEqual(craft([page(i, highlight=True) for i in range(1, 9)]), [])

    def test_every_rate_is_one_finding(self):
        """Not five codes and not one per page: a deck-level fact said once."""
        findings = craft([page(i, source=False, marks=2, annotated=False) for i in range(1, 9)])
        self.assertEqual(len(findings), 1)
        measured = findings[0]["measured"]
        self.assertEqual(sorted(measured),
                         ["chartsAnnotated", "commonestTableDevice", "drawnBridges",
                          "highlight", "marksPerPage", "source", "tablesTreated"])
        for phrase in ("emphasised", "carry a source", "drawn elements", "states the finding"):
            self.assertIn(phrase, findings[0]["repair"])

    def test_a_deck_that_draws_the_same_gutter_mark_on_every_page_is_reported(self):
        """The cold run set `implication: true` on all eight of its exhibit-left
        pages, so the dashed rule and disc ran the length of the deck and stopped
        meaning anything. The reference decks join evidence to its meaning in the
        commentary's heading, in a headed panel or in a closing band far more
        often than they draw it."""
        findings = craft([page(i, highlight=True, bridge="divider-chevron") for i in range(1, 9)])
        self.assertEqual(findings[0]["measured"]["drawnBridges"], 1.0)
        self.assertIn("draw a mark in the gutter", findings[0]["repair"])
        self.assertIn("divider-chevron", findings[0]["repair"])

    def test_a_deck_that_spends_the_gutter_mark_on_a_few_pages_passes(self):
        pages = [page(i, highlight=True, bridge="divider-chevron" if i <= 2 else None)
                 for i in range(1, 9)]
        self.assertEqual(craft(pages), [])

    def test_the_craft_floors_apply_at_build_time_not_only_to_a_plan(self):
        """`plan.craft` ran only when a `.plan.json` existed beside the spec, so
        a deck could ship a third of its charts unmarked and pass its own
        build. The floors are read from the same contract, on the scene."""
        findings = craft([page(i, highlight=True, annotated=False) for i in range(1, 9)])
        self.assertEqual(findings[0]["measured"]["chartsAnnotated"], 0.0)
        self.assertEqual(findings[0]["threshold"]["chartsAnnotated"],
                         page_gates.CONTRACT["plan"]["craft"]["chartAnnotated"]["min"])

    def test_a_short_deck_is_not_measured_on_a_rate(self):
        # Four pages cannot have a rate. The floor exists so that one page does
        # not decide what the deck is like.
        self.assertEqual(craft([page(i) for i in range(1, 4)]), [])

    def test_the_floors_come_from_client_work_not_from_us(self):
        judged = page_gates.REFERENCE_JUDGED
        craft = page_gates.CONTRACT["plan"]["craft"]
        self.assertLess(craft["highlightedPhrase"]["min"], judged["highlightedPhrase"])
        self.assertLess(craft["sourceLine"]["min"], judged["sourceLine"])
        self.assertLess(craft["marksPerPage"]["min"], page_gates.REFERENCE_PAGE["drawings"])

    def test_no_craft_floor_is_carried_in_two_places(self):
        """`highlight` sat at 0.35 in both the Python dict and weight.json, with
        nothing checking they agreed. The floors live beside the observations
        they were calibrated from; THRESHOLDS keeps the page-level numbers."""
        stray = [key for key in page_gates.THRESHOLDS
                 if key in {"highlight_share_min", "source_share_min", "marks_per_page_min",
                            "craft_from", "table_device_share_max", "table_device_from",
                            "drawn_bridge_share_max", "drawn_bridge_from"}]
        self.assertEqual(stray, [], "DECK_CRAFT floors belong in weight.json under plan.craft")


class PageHighlightTests(unittest.TestCase):
    """The page's own phrase, set in the accent wherever the page says it."""

    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")

    def test_a_page_highlight_reaches_the_points_that_say_it(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const slide = composeSlide({id:'s1', title:'Freight repricing took four points of margin',
  highlight:'four points',
  exhibit:{type:'table', columns:['Lane','Margin'], rows:[['North','12'],['South','8']]},
  points:[{text:'Freight repricing took four points of margin off the northern lanes'},
          {text:'The southern lanes were hedged into next year'}]}, {});
const find = (node) => node?.component === 'bullet-list' ? node
  : (node?.items ?? []).map(find).find(Boolean);
const points = find({items: slide.items});
console.log(JSON.stringify(points.props.items.map(p => p.highlight ?? null)));
''')
        self.assertEqual(result, [["four points"], None])

    def test_a_phrase_the_page_does_not_say_is_not_asserted(self):
        """A page-level highlight is offered to every piece of prose, and most
        of them will not contain it. That is not an error - it is the normal
        case, and making it one is what kept the phrase off the page."""
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const slide = composeSlide({id:'s1', title:'Freight repricing took four points of margin',
  highlight:'a phrase this page never says',
  exhibit:{type:'table', columns:['Lane','Margin'], rows:[['North','12'],['South','8']]},
  points:[{text:'Freight repricing took four points of margin off the northern lanes'},
          {text:'The southern lanes were hedged into next year'}]}, {});
const find = (node) => node?.component === 'bullet-list' ? node
  : (node?.items ?? []).map(find).find(Boolean);
const points = find({items: slide.items});
console.log(JSON.stringify(points.props.items.map(p => p.highlight ?? null)));
''')
        self.assertEqual(result, [None, None])


class ContentStageReachesThePageTests(unittest.TestCase):
    """A stage whose output nothing reads is a checkpoint, not a stage."""

    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def test_the_content_plans_highlight_is_set_on_the_page(self):
        spec = {"schema": "professional-slides.deck/v3", "id": "bound", "slides": [
            {"id": "inserted", "title": "Context precedes the evidence without changing its focus", "points": ["The context has no selected phrase."]},
            {"id": "target", "title": "The selected evidence supports a focused reader decision", "points": [{"lead": "Decision", "text": "A reversible first step preserves the next choice."}]}]}
        plan = {"schema": "professional-slides.content/v1", "id": "bound", "question": "Which step should the reader take?", "answer": "Take a reversible first step.", "pages": [{"id": "target", "claim": spec["slides"][1]["title"], "settles": {"kind": "qualitative", "what": "A reversible decision"}, "adds": None, "highlight": "reversible first step"}]}
        (self.tmp / "bound.deck.json").write_text(json.dumps(spec))
        (self.tmp / "bound.content.json").write_text(json.dumps(plan))
        out = self.tmp / "output"
        result = subprocess.run([NODE, str(BUILD), str(self.tmp / "bound.deck.json"), str(out), "--preflight", "--python", sys.executable], cwd=ROOT, capture_output=True, text=True)
        self.assertIn(result.returncode, (0, 2), result.stderr)
        scene = json.loads((out / "scene.json").read_text())
        accents = {s["id"]: [r["text"] for n in s["nodes"] for r in n.get("runs", []) if r.get("accent")] for s in scene["slides"]}
        self.assertIn("reversible first step", " ".join(accents["target"]))
        self.assertEqual(accents["inserted"], [])


if __name__ == "__main__":
    unittest.main()
