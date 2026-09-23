"""One weight contract, read by two languages.

The floors used to be a literal copy in `runtime/weight.mjs` and another in
`runtime/gates/page_gates.py`, so every density change had to be made twice and
nothing caught a miss. Both now read `runtime/weight.json`. These tests hold
that arrangement together: the composer and the gates must resolve the same
numbers, the documented vocabulary must match the emitted one, and the table in
the evaluation reference must still be the corpus the floors were calibrated against.
"""
from __future__ import annotations

import json
import re
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
        self.assertEqual(page_gates.REFERENCE_PAGE_WORDS, CONTRACT["reference"]["corpus"])
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

    def test_every_floored_key_is_documented(self):
        # A key with no line of documentation is a floor nobody can author
        # against; a documented key with no floor is a promise the gates do not
        # keep.
        for fill, values in CONTRACT["byFill"].items():
            self.assertEqual(sorted(values), sorted(CONTRACT["keys"]), fill)
            self.assertEqual(sorted(values), sorted(CONTRACT["ranges"]), fill)
        skill = (SKILL / "references/theming.md").read_text(encoding="utf-8")
        for key in CONTRACT["keys"]:
            self.assertIn(f"`{key}`", skill, f"The theming reference never names the {key} floor")

    def test_the_floors_stay_under_the_corpus_they_are_calibrated_against(self):
        # A floor is not a target. The body floor sits below the reference
        # body median, or the gate is asking pages to be denser than the decks
        # it was measured from.
        body = CONTRACT["reference"]["slides"]["bands"]["body"]
        for fill, values in CONTRACT["byFill"].items():
            self.assertLessEqual(values["pageWords"], body, fill)
        self.assertLess(CONTRACT["byFill"]["airy"]["pageWords"], CONTRACT["byFill"]["balanced"]["pageWords"])
        self.assertLess(CONTRACT["byFill"]["balanced"]["pageWords"], CONTRACT["byFill"]["full"]["pageWords"])

    def test_the_skill_quotes_the_corpus_it_was_measured_from(self):
        # The comparison table in the evaluation reference is the argument for the floors. If
        # the corpus is re-measured, the table moves with it rather than
        # standing as a second, older record of the same thing.
        skill = (SKILL / "references/evaluation/index.md").read_text(encoding="utf-8")
        slides = CONTRACT["reference"]["slides"]
        wide = CONTRACT["reference"]["corpus"]
        self.assertIn(f"{wide['pages']:,} analytical pages", skill)
        for value in (slides["words"], slides["bands"]["titleBand"], slides["bands"]["body"],
                      slides["bands"]["footer"], slides["drawings"],
                      slides["numericByFamily"]["chart"]):  # noqa: E501
            self.assertRegex(skill, rf"\|[^|\n]*\b{value}\b", f"the evaluation reference's corpus table has lost {value}")
        self.assertIn(f"{round(slides['heavyShare'] * 100)}%", skill)
        # And the craft rates the plan gates now floor against.
        craft = CONTRACT["plan"]["craft"]
        for key in ("chartAnnotated", "tableTreated"):
            self.assertIn(f"{round(craft[key]['observedClient'] * 100)}%", skill,
                          f"the evaluation reference does not say what client decks do for {key}")

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


class GateVocabularyTests(unittest.TestCase):
    """Every code the gates emit is documented, and every documented code exists."""

    def test_the_emitted_codes_are_the_documented_codes(self):
        self.assertEqual(sorted(page_gates.GATE_CODES), sorted(page_gates.emitted_codes()))

    def test_no_document_names_a_gate_that_does_not_exist(self):
        # The model reviewer keeps its own vocabulary, read from its module.
        reviewer = set(re.findall(r"^  ([A-Z][A-Z_]{3,}):", (SKILL / "runtime" / "reviewer.mjs").read_text(encoding="utf-8"), re.M))
        # The plan and content stages keep their vocabularies in their own
        # modules, and the docs that teach those stages name them.
        stages = set()
        for module in ("gates/plan_gates.mjs", "gates/content_gates.mjs", "claims.mjs"):
            source = (SKILL / "runtime" / module).read_text(encoding="utf-8")
            stages |= set(re.findall(r"^  ([A-Z][A-Z_]{3,}):", source, re.M))
        # Runtime constants that are named in the docs and are not codes.
        constants = {"LABEL_HEADROOM", "RUNTIME_PYTHON"}
        allowed = set(page_gates.GATE_CODES) | set(page_gates.COMPOSE_CODES) | reviewer | stages | constants
        shaped = re.compile(r"`([A-Z][A-Z_]{3,})`")
        for path in sorted(SKILL.rglob("*.md")):
            named = set(shaped.findall(path.read_text(encoding="utf-8")))
            unknown = named - allowed
            self.assertFalse(unknown, f"{path.name} names codes that are never emitted: {sorted(unknown)}")

    def test_the_material_codes_are_codes_the_reviewer_can_raise(self):
        # rules.json marks which review codes block. A code listed there that
        # the reviewer's schema does not accept is a promise nothing can keep.
        reviewer = set(re.findall(r"^  ([A-Z][A-Z_]{3,}):", (SKILL / "runtime" / "reviewer.mjs").read_text(encoding="utf-8"), re.M))
        material = json.loads((SKILL / "references" / "evaluation" / "rules.json").read_text(encoding="utf-8"))["materialCodes"]
        self.assertFalse(set(material) - reviewer, "rules.json marks codes the review schema rejects")

    def test_the_gate_table_lists_every_gate(self):
        index = (SKILL / "references" / "evaluation" / "index.md").read_text(encoding="utf-8")
        missing = [code for code in page_gates.GATE_CODES if f"`{code}`" not in index]
        self.assertFalse(missing, f"the evaluation gate table has no row for {missing}")


if __name__ == "__main__":
    unittest.main()
