"""One weight contract, read by two languages.

The floors used to be a literal copy in `runtime/weight.mjs` and another in
`runtime/gates/page_gates.py`, so every density change had to be made twice and
nothing caught a miss. Both now read `runtime/weight.json`. These tests hold
that arrangement together: the composer and the gates must resolve the same
numbers, and the threshold table in the evaluation reference is the one the
gates print. And the codes every stage emits are held to one registry: each
registered in exactly one vocabulary, and every emitted code registered.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
GATES = SKILL / "runtime" / "gates"
CONTRACT = json.loads((SKILL / "runtime" / "weight.json").read_text(encoding="utf-8"))

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


class WeightContractTests(unittest.TestCase):
    def test_the_gates_read_the_contract_file(self):
        self.assertEqual(page_gates.WEIGHT_BY_FILL, CONTRACT["byFill"])
        self.assertEqual(page_gates.FILL_LEVELS, CONTRACT["geometryByFill"])
        self.assertEqual(page_gates.DEFAULT_FILL, CONTRACT["defaultFill"])
        self.assertEqual(page_gates.REFERENCE_PAGE_WORDS, CONTRACT["reference"]["benchmark"])
        self.assertEqual(page_gates.REFERENCE_PAGE_BANDS["body"], CONTRACT["reference"]["slides"]["bands"]["body"])

    def test_the_composer_resolves_what_the_gates_enforce(self):
        result = run_node('''
import {WEIGHT_BY_FILL, WEIGHT_KEYS, resolveWeight, REFERENCE_PAGE_BANDS, REFERENCE} from './skills/professional-slides/runtime/weight.mjs';
console.log(JSON.stringify({byFill: WEIGHT_BY_FILL, keys: WEIGHT_KEYS, bands: REFERENCE_PAGE_BANDS,
                            slides: REFERENCE.slides, resolved: resolveWeight({weight: {pageWords: 130}}, 'full')}));
''')
        self.assertEqual(result["byFill"], CONTRACT["byFill"])
        self.assertEqual(result["keys"], list(CONTRACT["keys"]))
        self.assertEqual(result["bands"]["body"], CONTRACT["reference"]["slides"]["bands"]["body"])
        # The spec's own weight wins over the fill default, key by key.
        self.assertEqual(result["resolved"]["pageWords"], 130)
        self.assertEqual(result["resolved"]["columnFill"], CONTRACT["byFill"]["full"]["columnFill"])

    def test_every_fill_floors_every_key(self):
        # A key one fill leaves out is a floor that fill does not keep.
        for fill, values in CONTRACT["byFill"].items():
            self.assertEqual(sorted(values), sorted(CONTRACT["keys"]), fill)
            self.assertEqual(sorted(values), sorted(CONTRACT["ranges"]), fill)

    def test_the_floors_stay_under_the_corpus_they_are_calibrated_against(self):
        # A floor is not a target. The body floor sits below the reference
        # body median, or the gate is asking pages to be denser than the decks
        # it was measured from.
        body = CONTRACT["reference"]["slides"]["bands"]["body"]
        for fill, values in CONTRACT["byFill"].items():
            self.assertLessEqual(values["pageWords"], body, fill)
        self.assertLess(CONTRACT["byFill"]["airy"]["pageWords"], CONTRACT["byFill"]["balanced"]["pageWords"])
        self.assertLess(CONTRACT["byFill"]["balanced"]["pageWords"], CONTRACT["byFill"]["full"]["pageWords"])

    def test_the_gate_thresholds_are_printed_from_the_code(self):
        # The threshold table is page_gates.py --thresholds-markdown, verbatim:
        # the evaluation reference said 22% for an internal void the code held
        # at 13%, and 128 words for a ceiling of 148, because a hand-kept table
        # was checked only for whether its numbers appeared somewhere.
        index = (SKILL / "references" / "evaluation" / "index.md").read_text(encoding="utf-8")
        begin, end = "<!-- thresholds:begin -->\n", "<!-- thresholds:end -->"
        self.assertIn(begin, index)
        block = index[index.index(begin) + len(begin):index.index(end)]
        run = subprocess.run([sys.executable, str(GATES / "page_gates.py"), "--thresholds-markdown"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(block, run.stdout, "regenerate the block: python3 runtime/gates/page_gates.py --thresholds-markdown")
        self.assertEqual(block, page_gates.thresholds_markdown())
        # The table reads the values the gates apply, fill by fill.
        for fill in ("full", "balanced", "airy"):
            self.assertIn(page_gates._share(CONTRACT["geometryByFill"][fill]["internal_void_block"]), block)
        self.assertIn(f"| {page_gates.PROFILES['executive']['words_exhibit']} |", block)

    def test_the_contract_says_where_its_figures_come_from(self):
        calibration = CONTRACT["calibration"]
        for key in ("date", "method", "sample"):
            self.assertTrue(str(calibration.get(key, "")).strip(), key)
        text = json.dumps(calibration)
        self.assertNotRegex(text, r"[/\\]\w+\.(pptx|pdf|json)|/Users/|corpus/", "the provenance names no file or path")

    def test_every_deck_wide_rule_reads_its_length_from_the_contract(self):
        lengths = CONTRACT["deckLength"]
        self.assertEqual(page_gates.THRESHOLDS["sections_from"], lengths["sections"])
        self.assertEqual(page_gates.THRESHOLDS["front_matter_from"], lengths["frontMatter"])
        self.assertEqual(page_gates.THRESHOLDS["deck_shape_from"], lengths["deckShape"])
        self.assertEqual(page_gates.THRESHOLDS["shape_variety_from"], lengths["shapeVariety"])
        self.assertEqual(page_gates.DECK_HABIT["from"], lengths["emptyHabit"])
        result = run_node('''
import { VARIETY } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import { CONTENT_THRESHOLDS } from './skills/professional-slides/runtime/gates/content_gates.mjs';
console.log(JSON.stringify({ variety: VARIETY.from, content: CONTENT_THRESHOLDS.from }));
''')
        self.assertEqual(result, {"variety": lengths["variety"], "content": lengths["content"]})
        # The craft floors hold at the contract's own numbers, read off what they
        # find either side of each: the deck length they read from, the treated-
        # table and annotated-chart shares they block under, and the length the
        # device floors (icons) start at.
        craft = CONTRACT["plan"]["craft"]
        tables, charts = craft["tableTreated"], craft["chartAnnotated"]
        n = max(lengths["craft"], tables["blockFrom"], charts["blockFrom"])
        cases = {
            "short": ("table", lengths["craft"] - 1, 0),
            "tablesUnder": ("table", n, math.ceil(tables["blockBelow"] * n) - 1),
            "tablesAt": ("table", n, math.ceil(tables["blockBelow"] * n)),
            "chartsUnder": ("chart", n, math.ceil(charts["blockBelow"] * n) - 1),
            "chartsAt": ("chart", n, math.ceil(charts["blockBelow"] * n)),
            "devicesUnder": ("table", lengths["craftDevices"] - 1, lengths["craftDevices"] - 1),
            "devicesAt": ("table", lengths["craftDevices"], lengths["craftDevices"]),
        }
        found = run_node(f'''
import {{ craftFindings }} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const trend = {{ type: 'chart.line', categories: ['2020', '2021', '2022', '2023', '2024'], series: [{{ name: 'Revenue', values: [1, 2, 3, 4, 5] }}] }};
const table = {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1'], ['y', '2'], ['z', '3']] }};
const deck = ([kind, pages, marked]) => {{
  const spec = {{ slides: Array.from({{ length: pages }}, (_, i) => ({{ id: 'p' + i, title: 'A finding on page ' + i, exhibit: kind === 'chart' ? trend : table }})) }};
  const scene = {{ slides: [{{ id: 'cover', componentInstances: [{{ component: 'cover' }}], nodes: [] }}, ...Array.from({{ length: pages }}, (_, i) => ({{ id: 'p' + i,
    componentInstances: [{{ component: kind === 'chart' ? 'chart.line' : 'table' }}],
    nodes: [{{ role: 'action-title' }}, {{ role: kind === 'chart' ? 'chart-mark' : 'table-cell' }},
      ...(i < marked ? [{{ role: kind === 'chart' ? 'chart-bracket' : 'table-harvey-ball' }}] : [])] }}))] }};
  return craftFindings(spec, scene).map((f) => f.code);
}};
console.log(JSON.stringify(Object.fromEntries(Object.entries({json.dumps(cases)}).map(([name, c]) => [name, deck(c)]))));
''')
        self.assertEqual(found["short"], [], "a deck under the craft length is a probe, not a deck")
        self.assertIn("CRAFT_TABLES_PLAIN", found["tablesUnder"])
        self.assertNotIn("CRAFT_TABLES_PLAIN", found["tablesAt"])
        self.assertIn("CRAFT_CHARTS_BARE", found["chartsUnder"])
        self.assertNotIn("CRAFT_CHARTS_BARE", found["chartsAt"])
        self.assertNotIn("CRAFT_NO_ICONS", found["devicesUnder"])
        self.assertIn("CRAFT_NO_ICONS", found["devicesAt"])

    def test_no_floor_is_stricter_than_the_corpus_it_claims_to_come_from(self):
        """A floor that most published pages fail is a preference, not a floor.

        Every geometric threshold records the share of the 2,125 rendered corpus
        pages it would flag. None of them may flag more than a third, and the
        ink ladder has to rise with fill rather than crossing over.
        """
        flagged = CONTRACT["reference"]["slides"]["exceedance"]
        levels = CONTRACT["geometryByFill"]
        for fill in ("airy", "balanced", "full"):
            share = flagged["inkBelow"][str(levels[fill]["ink_min"])]
            self.assertLess(share, 0.34, f"{fill} ink floor rejects {share:.0%} of published pages")
        self.assertLess(levels["airy"]["ink_min"], levels["balanced"]["ink_min"])
        self.assertLess(levels["balanced"]["ink_min"], levels["full"]["ink_min"])
        for fill in ("airy", "balanced", "full"):
            self.assertLess(flagged["internalVoidAbove"][str(levels[fill]["internal_void_max"])], 0.05)


RUNTIME = SKILL / "runtime"
# A code is upper case with underscores, three letters and up: CPL is one.
CODE = r"[A-Z][A-Z0-9_]{2,}"


def vocabularies():
    """Every code vocabulary the runtime declares, keyed module:table.

    A vocabulary is a table of code -> the line that says what it is about:
    `export const X_CODES = Object.freeze({ ... })` (the reviewer's is `CODES`)
    in Node, `X_CODES = { "CODE": "...", ... }` in Python. Sets of codes that
    select from a vocabulary (ADVISORY_CODES) have no lines and are not one.
    """
    tables = {}
    for path in sorted(RUNTIME.rglob("*.mjs")):
        source = path.read_text(encoding="utf-8")
        for m in re.finditer(r"^export const (\w*CODES) = Object\.freeze\(\{\n(.*?)^\}\);", source, re.M | re.S):
            tables[f"{path.relative_to(RUNTIME)}:{m.group(1)}"] = set(re.findall(rf"^\s+({CODE}):", m.group(2), re.M))
    for path in sorted(RUNTIME.rglob("*.py")):
        source = path.read_text(encoding="utf-8")
        for m in re.finditer(r"^(\w*CODES) = \{\n(.*?)^\}", source, re.M | re.S):
            keys = set(re.findall(rf'^\s+"({CODE})":', m.group(2), re.M))
            if keys:
                tables[f"{path.relative_to(RUNTIME)}:{m.group(1)}"] = keys
    return tables


def registered():
    return set().union(*vocabularies().values())


class AnalyticalPageTests(unittest.TestCase):
    """One definition of the page that argues, read by the gates, the census and the review."""

    def test_the_gates_and_the_review_count_the_same_pages(self):
        # The gates counted pages with a reading task, the census counted a
        # takeaways page as analytical, and the review's statistics counted
        # every page with an action title, agendas and the credits included.
        chrome = {"component": "slide-chrome"}
        title = {"role": "action-title", "text": "A finding"}
        slides = [
            {"id": "cover", "componentInstances": [{"component": "cover"}], "nodes": []},
            {"id": "agenda-1", "componentInstances": [chrome, {"component": "agenda"}], "nodes": [title]},
            {"id": "p03", "componentInstances": [chrome], "nodes": [title]},
            {"id": "p04", "componentInstances": [chrome], "readingTask": "chart-led", "nodes": []},
            {"id": "s1", "componentInstances": [{"component": "section-divider"}], "nodes": []},
            {"id": "p06", "componentInstances": [{"component": "takeaways"}], "readingTask": "text-page", "nodes": []},
            {"id": "picture-credits", "componentInstances": [chrome], "nodes": [title]},
        ]
        gates = [page_gates.analytical(slide, i) for i, slide in enumerate(slides)]
        result = run_node(f'''
import {{ isAnalyticalPage }} from './skills/professional-slides/runtime/weight.mjs';
console.log(JSON.stringify({json.dumps(slides)}.map(isAnalyticalPage)));
''')
        self.assertEqual(gates, [False, False, True, True, False, False, False])
        self.assertEqual(result, gates)


class GateVocabularyTests(unittest.TestCase):
    """Every code the runtime emits is registered once."""

    def test_the_emitted_codes_are_the_documented_codes(self):
        self.assertEqual(sorted(page_gates.GATE_CODES), sorted(page_gates.emitted_codes()))
        # Each says what it is about: a code with an empty line is registered in name only.
        self.assertEqual([code for code, about in page_gates.GATE_CODES.items() if not str(about).strip()], [])

    def test_the_vocabularies_are_read_from_their_modules(self):
        # The parse above is what the other tests stand on: it must find the
        # tables the modules import, not a subset of them.
        tables = vocabularies()
        self.assertEqual(tables["gates/gate_config.py:GATE_CODES"], set(page_gates.GATE_CODES))
        self.assertEqual(tables["gates/gate_config.py:COMPOSE_CODES"], set(page_gates.COMPOSE_CODES))
        result = run_node('''
import { CODES } from './skills/professional-slides/runtime/reviewer.mjs';
import { DELIVERY_CODES } from './skills/professional-slides/runtime/deliver-deck.mjs';
console.log(JSON.stringify({ reviewer: Object.keys(CODES), delivery: Object.keys(DELIVERY_CODES) }));
''')
        self.assertEqual(tables["reviewer.mjs:CODES"], set(result["reviewer"]))
        self.assertEqual(tables["deliver-deck.mjs:DELIVERY_CODES"], set(result["delivery"]))
        self.assertIn("CPL", tables["gates/gate_config.py:GATE_CODES"])

    def test_every_code_the_runtime_emits_is_registered(self):
        # Delivery used to refuse decks with REVIEW_PASS_CAP, MISSING_RENDERED_GATES
        # and STORYLINE_NOT_READY, which no vocabulary held, so nothing said what
        # they meant or kept a doc naming them honest. Every `code: "..."` a Node
        # module writes and every `"code": "..."` a Python one writes is now in
        # exactly one table.
        emitted = {}
        for path in sorted(RUNTIME.rglob("*.mjs")) + sorted(RUNTIME.rglob("*.py")):
            pattern = rf"""\bcode:\s*["']({CODE})["']""" if path.suffix == ".mjs" else rf'"code":\s*"({CODE})"'
            for code in re.findall(pattern, path.read_text(encoding="utf-8")):
                emitted.setdefault(code, set()).add(str(path.relative_to(RUNTIME)))
        self.assertIn("REVIEW_PASS_CAP", emitted)  # the grep reaches delivery
        unregistered = {code: sorted(where) for code, where in emitted.items() if code not in registered()}
        self.assertFalse(unregistered, f"codes emitted but registered in no vocabulary: {unregistered}")

    def test_no_code_is_registered_twice(self):
        # One code, one meaning, one owner. MISSING_ARGUMENT meant a page with
        # no argument drawn on it to the gates and an unclear inference to the
        # reviewer; a code in two tables is either that or a copy that drifts.
        owners = {}
        for table, codes in vocabularies().items():
            for code in codes:
                owners.setdefault(code, []).append(table)
        twice = {code: tables for code, tables in owners.items() if len(tables) > 1}
        self.assertFalse(twice, f"codes registered in more than one vocabulary: {twice}")

    def test_the_material_codes_are_codes_a_review_can_raise(self):
        # rules.json marks which codes block a review. The reviewer raises its
        # own codes and confirms a build check's under that check's code
        # (MISSING_EVIDENCE, LAYOUT_MONOTONY); a material code in neither is a
        # promise nothing can keep.
        tables = vocabularies()
        raisable = tables["reviewer.mjs:CODES"] | tables["gates/gate_config.py:GATE_CODES"] | tables["gates/gate_config.py:COMPOSE_CODES"]
        material = json.loads((SKILL / "references" / "evaluation" / "rules.json").read_text(encoding="utf-8"))["materialCodes"]
        self.assertFalse(set(material) - raisable, "rules.json marks codes no review can raise")


if __name__ == "__main__":
    unittest.main()
