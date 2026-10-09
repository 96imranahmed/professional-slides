"""Every finding code has one class, and a run reports the classes in order.

A fifty-page deck took 33 compiles, 19 refused, because the rules were met in
the order the code happened to run them: a page was polished until it fitted,
and then a deck-level rule on the mix of exhibits sent it to another form; a
rule over the deck's types could not be seen while one of its pages failed to
compile; and the rules only a render measures were first heard at the build.

So every code belongs to one class (gates/gate_classes.mjs): S, the deck's
structure, read off the pages' declared choices; P, one page against its own
evidence; G, an aggregate measured across the composed pages; R, raised after
the build by a review. These tests hold the registry to the vocabularies -
no code unclassed, no class for a code that no longer exists - and hold the
copies of a rule that are read in two languages to one answer.
"""
from __future__ import annotations

import json
import re
import sys
import unittest

from node_probe import ROOT, SKILL, run_node

RUNTIME = SKILL / "runtime"
sys.path.insert(0, str(RUNTIME / "gates"))
import page_gates  # noqa: E402

CODE = r"[A-Z][A-Z0-9_]{2,}"


def vocabularies():
    """Every code vocabulary the runtime declares, keyed module:table (the parse test_weight_contract.py holds to the modules)."""
    tables = {}
    for path in sorted(RUNTIME.rglob("*.mjs")):
        for m in re.finditer(r"^export const (\w*CODES) = Object\.freeze\(\{\n(.*?)^\}\);", path.read_text(encoding="utf-8"), re.M | re.S):
            tables[f"{path.relative_to(RUNTIME)}:{m.group(1)}"] = set(re.findall(rf"^\s+({CODE}):", m.group(2), re.M))
    for path in sorted(RUNTIME.rglob("*.py")):
        for m in re.finditer(r"^(\w*CODES) = \{\n(.*?)^\}", path.read_text(encoding="utf-8"), re.M | re.S):
            keys = set(re.findall(rf'^\s+"({CODE})":', m.group(2), re.M))
            if keys:
                tables[f"{path.relative_to(RUNTIME)}:{m.group(1)}"] = keys
    return tables


def registry():
    return run_node('''
import { GATE_CLASSES, CLASSES, CLASS_ORDER, LAYOUT_CODES, STANDING_FREE } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
console.log(JSON.stringify({ classes: GATE_CLASSES, names: Object.keys(CLASSES), order: CLASS_ORDER, layout: [...LAYOUT_CODES], free: STANDING_FREE }));
''')


class RegistryTests(unittest.TestCase):
    def test_every_code_has_exactly_one_class_and_every_classed_code_exists(self):
        tables = vocabularies()
        # The parse reaches every family the registry is meant to cover.
        for table in ("author-deck.mjs:AUTHORING_CODES", "gates/variety_gates.mjs:VARIETY_CODES", "gates/dependency_gates.mjs:DEPENDENCY_CODES",
                      "gates/content_gates.mjs:CONTENT_CODES", "gates/craft_gates.mjs:CRAFT_CODES", "gates/plan_gates.mjs:PLAN_CODES",
                      "page-types.mjs:CHART_FORM_CODES", "gates/gate_config.py:GATE_CODES", "gates/density_profile.py:DENSITY_CODES"):
            self.assertIn(table, tables)
        emitted = set().union(*tables.values())
        result = registry()
        classed = set(result["classes"])
        self.assertFalse(emitted - classed, f"codes with no class in gates/gate_classes.mjs: {sorted(emitted - classed)}")
        self.assertFalse(classed - emitted, f"gates/gate_classes.mjs classes codes no vocabulary holds: {sorted(classed - emitted)}")
        self.assertEqual(set(result["classes"].values()) - set(result["names"]), set())
        self.assertEqual(result["order"], ["S", "P", "G"])

    def test_an_unclassed_code_throws(self):
        result = run_node('''
import { classOf } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
let message = null;
try { classOf('NOT_A_CODE'); } catch (error) { message = error.message; }
console.log(JSON.stringify({ message, known: [classOf('VARIETY_EXHIBIT_MIX'), classOf('SCENE_VOID'), classOf('TEXT_FRAGMENTED'), classOf('REVIEW_RATING')] }));
''')
        self.assertIn("Unclassified finding code: NOT_A_CODE", result["message"])
        self.assertEqual(result["known"], ["S", "P", "G", "R"])

    def test_the_layout_codes_are_page_local(self):
        result = registry()
        self.assertTrue(result["layout"])
        self.assertEqual([code for code in result["layout"] if result["classes"].get(code) != "P"], [])
        for code in ("PAGE_DOES_NOT_COMPOSE", "SCENE_VOID", "DEAD_BAND", "COLUMN_VOID", "TEXT_COVERAGE_LOW", "THIN_PAGE"):
            self.assertIn(code, result["layout"])

    def test_the_named_rules_sit_in_the_classes_the_order_depends_on(self):
        classes = registry()["classes"]
        # Deck structure: the variety contract, the page-shape share, type runs, the spine.
        for code in ("VARIETY_EXHIBIT_MIX", "VARIETY_EXHIBIT_RANGE", "VARIETY_TYPE_RUN", "VARIETY_COMMENTARY", "PAGE_SHAPE_FLAT", "NO_SUMMARY", "PLAYERS_UNMARKED",
                     "TITLE_GAP_SHARE", "PILLAR_UNSUPPORTED", "PLAN_STYLE_ENTROPY", "CONTENT_ANSWER_UNCARRIED"):
            self.assertEqual(classes[code], "S", code)
        # Page-local: compile, composition, the scene, the words, what the page rests on, the chart's form.
        for code in ("COMPILE", "PAGE_DOES_NOT_COMPOSE", "SCENE_VOID", "SCENE_INK", "TEXT_COVERAGE_LOW", "BASIS_VALUES", "RELATION_SPLIT", "SCATTER_OVER_TIME", "NOTE_HEAVY"):
            self.assertEqual(classes[code], "P", code)
        # Aggregates: medians, rates and habits measured across composed or rendered pages.
        for code in ("TEXT_FRAGMENTED", "DECK_INK", "DECK_CRAFT", "DECK_THIN_PAGES", "DECK_SCENE_VOID", "EVIDENCE_DEPTH", "DECK_FLAT"):
            self.assertEqual(classes[code], "G", code)


class StandingTests(unittest.TestCase):
    """Where the deck stands is one record in both languages, and one line a rule."""

    def test_a_share_is_counted_in_pages(self):
        result = run_node('''
import { standingLine, standingRoom } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const share = (count, of, bar, side = 'max') => ({ code: 'VARIETY_EXHIBIT_MIX', key: 'table.max', what: 'pages carried by a table', value: count / of, bar, side, count, of, applies: true, blocks: true });
const lines = [share(14, 46, 0.3), share(13, 44, 0.3), share(12, 44, 0.3), share(8, 44, 0.2, 'min'), share(9, 44, 0.2, 'min'), { ...share(2, 5, 0.3), applies: false }];
console.log(JSON.stringify({ lines: lines.map(standingLine), rooms: lines.map(standingRoom),
  measured: standingLine({ code: 'EVIDENCE_DEPTH', what: 'values the median chart page plots', value: 12, bar: 15, side: 'min', unit: 'values', applies: true, blocks: true }),
  present: standingLine({ code: 'NO_SUMMARY', what: 'an opening executive summary', value: 0, bar: 1, side: 'min', unit: 'present', applies: true, blocks: true }) }));
''')
        over, at, room, short, floor, unread = result["lines"]
        self.assertEqual(over, "VARIETY_EXHIBIT_MIX.table.max: pages carried by a table 14 of 46 pages, 30.4%; cap 30%: over by 1 page - BLOCKS")
        self.assertIn("13 of 44 pages, 29.5%; cap 30%: at the cap, 1 more blocks", at)
        self.assertIn("cap 30%: room for 1 page more", room)
        self.assertIn("floor 20%: short by 1 page - BLOCKS", short)
        self.assertIn("at the floor, 1 fewer blocks", floor)
        self.assertIn("not held yet", unread)
        self.assertEqual([r["state"] for r in result["rooms"]], ["over", "at", "ok", "short", "at", "unread"])
        self.assertEqual([r["margin"] for r in result["rooms"][:5]], [-1, 0, 1, -1, 0])
        self.assertIn("floor 15: short by 3 values - BLOCKS", result["measured"])
        self.assertIn("an opening executive summary: absent: missing - BLOCKS", result["present"])

    def test_every_structure_and_aggregate_rule_has_a_standing_or_says_why_not(self):
        # The registry lists the deck-level codes that have no quantity to stand against, each with its reason;
        # every other S or G code is written by a `stand` or `standing` call somewhere in the runtime.
        result = registry()
        source = "".join(path.read_text(encoding="utf-8") for path in sorted(RUNTIME.rglob("*.mjs")) + sorted(RUNTIME.rglob("*.py")))
        written = set(re.findall(rf'stand(?:ing)?\(\s*"({CODE})"', source)) | set(re.findall(rf"""code: ["']({CODE})["'], (?:key: ["']\w+["'], )?what:""", source)) \
            | set(re.findall(rf'"code": "({CODE})", "key"', source)) | {"DECK_THIN_PAGES", "DECK_SCENE_VOID"}
        deck_level = {code for code, cls in result["classes"].items() if cls in ("S", "G")}
        free = result["free"]
        self.assertFalse(set(free) - deck_level, "a standing is only waived for a structure or aggregate code")
        self.assertEqual([code for code, why in free.items() if len(str(why).split()) < 4], [], "each says why it has no standing")
        self.assertFalse(deck_level - written - set(free), f"S or G codes with neither a standing nor a reason: {sorted(deck_level - written - set(free))}")
        self.assertFalse(written & set(free), f"codes with a standing that are listed as having none: {sorted(written & set(free))}")


class ParityTests(unittest.TestCase):
    """A rule read in two places gives one answer."""

    def test_page_shape_is_one_rule_in_both_languages(self):
        shapes = ["evidence-only", "evidence-with-commentary", "evidence-only", "paired-evidence", "evidence-only", "text", "evidence-only", "card-grid",
                  "evidence-only", "evidence-with-commentary", "evidence-only", "reconciliation", "evidence-only", "evidence-only"]
        result = run_node(f'''
import {{ SHAPE, shapeVariety }} from './skills/professional-slides/runtime/deck-structure.mjs';
console.log(JSON.stringify({{ shape: SHAPE, variety: shapeVariety({json.dumps(shapes)}) }}));
''')
        per_ten, commonest, count = page_gates.deck_gates.shape_variety(shapes)
        self.assertAlmostEqual(result["variety"]["perTen"], per_ten)
        self.assertEqual([result["variety"]["commonest"], result["variety"]["count"]], [commonest, count])
        self.assertEqual(result["shape"], {"from": page_gates.THRESHOLDS["shape_variety_from"], "perTenMin": page_gates.THRESHOLDS["shapes_per_ten_min"],
                                           "shareMax": page_gates.THRESHOLDS["shape_share_max"]})

    def test_a_page_declares_the_architecture_and_the_skeleton_it_composes_to(self):
        # The worked example of every type: its declared stand-in is counted by the variety contract exactly as its
        # compiled page is, and the architecture told from its choices is the one the page gates measure on its scene.
        result = run_node('''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileDeck, composeForAuthoring, sceneGateFindings } from './skills/professional-slides/runtime/author-deck.mjs';
import { declaredSlide } from './skills/professional-slides/runtime/page-types.mjs';
import { declaredArchitecture } from './skills/professional-slides/runtime/deck-structure.mjs';
import { pageFamily, exhibitKinds } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const doc = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const { spec } = compileDeck(doc, { partial: true });
const { deck } = await composeForAuthoring(spec, examples);
const measured = new Map(sceneGateFindings(deck, process.env.RUNTIME_PYTHON || 'python3', spec).architectures.map((a) => [a.id, a.architecture]));
const compiled = new Map([...spec.slides, ...(spec.appendix || [])].map((slide) => [slide.id, slide]));
const differ = [];
let pages = 0;
for (const page of [...doc.pages, ...(doc.appendix || [])].filter((p) => p.type)) {
  const real = compiled.get(page.id), stand = declaredSlide(page);
  pages += 1;
  for (const key of ['skeleton', 'structure']) if (stand.pageType[key] !== real.pageType[key]) differ.push([page.id, key, stand.pageType[key], real.pageType[key]]);
  if (JSON.stringify(stand.pageType.drawn) !== JSON.stringify(real.pageType.drawn)) differ.push([page.id, 'drawn']);
  if (pageFamily(stand) !== pageFamily(real) || String(exhibitKinds(stand)) !== String(exhibitKinds(real))) differ.push([page.id, 'family or kinds']);
  if (measured.has(page.id) && declaredArchitecture(real) !== measured.get(page.id)) differ.push([page.id, 'architecture', declaredArchitecture(real), measured.get(page.id)]);
  if (declaredArchitecture(stand) !== declaredArchitecture(real)) differ.push([page.id, 'declared architecture', declaredArchitecture(stand), declaredArchitecture(real)]);
}
console.log(JSON.stringify({ pages, measured: measured.size, differ }));
''')
        self.assertGreaterEqual(result["pages"], 40)
        self.assertGreaterEqual(result["measured"], 40)
        self.assertEqual(result["differ"], [])


if __name__ == "__main__":
    unittest.main()
