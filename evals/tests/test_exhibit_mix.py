"""The exhibit mix, counted where the count is exact, and the ceilings that block.

A delivered fifty-page deck ran 42% "diagram" against a 10-15% reference and
18.6% charts against a 25% floor, drew 3.3 kinds of exhibit per ten pages
against 7-8 in the examples, declared 63% of its evidence qualitative against
a 34% ceiling, and never carried its own answer - all advisory, all shipped.
The "diagram" figure was a labelling fault: everything that was not a chart,
a table or text fell into it, fact grids and cards included.

So numbers and cards are their own family; the mix and the exhibit range are
enforced on the compiled pages by the variety contract, where each page's
family is the exhibit it draws; the plan's statistics, which read labels the
author declared, stay advisory; and the content ceilings block.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads((ROOT / "skills" / "professional-slides" / "runtime" / "weight.json").read_text(encoding="utf-8"))

DECK = '''
const chart = (type = 'chart.bar') => ({ type, categories: ['A', 'B', 'C'], series: [{ name: 'x', values: [1, 2, 3] }] });
const typed = (i, type, form, exhibit) => ({ id: 'p' + i, title: 'Page ' + i + ' makes a claim', pageType: { type, form, commentary: 'none', takeaway: false }, ...(exhibit ? { exhibit } : {}) });
'''


class ExhibitFamilyTests(unittest.TestCase):
    def test_numbers_and_cards_are_their_own_family(self):
        result = run_node('''
import { exhibitFamily } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import { family } from './skills/professional-slides/runtime/gates/plan_gates.mjs';
const types = ['chart.line', 'chart-group', 'metrics', 'table', 'rows', 'fact-grid', 'cards', 'labelled-rows', 'flow', 'steps', 'cycle', 'map', 'image', 'text', '', 'paired'];
console.log(JSON.stringify({ exhibit: Object.fromEntries(types.map((t) => [t, exhibitFamily(t)])),
  plan: [family({ exhibit: 'fact-grid' }), family({ exhibit: 'table', architecture: 'picture-pair' }), family({ exhibit: 'flow' }), family({ kind: 'section' })] }));
''')
        self.assertEqual(result["exhibit"], {
            "chart.line": "chart", "chart-group": "chart", "metrics": "chart", "table": "table", "rows": "table",
            "fact-grid": "numbers", "cards": "numbers", "labelled-rows": "numbers", "flow": "diagram", "steps": "diagram",
            "cycle": "diagram", "map": "diagram", "image": "picture", "text": "text", "": "text", "paired": "mixed"})
        self.assertEqual(result["plan"], ["numbers", "picture", "diagram", None])

    def test_the_plan_mix_splits_the_families_and_only_advises(self):
        result = run_node('''
import { runPlanGates } from './skills/professional-slides/runtime/gates/plan_gates.mjs';
const pages = Array.from({ length: 20 }, (_, i) => ({ n: i + 1, title: 'A page that states something measurable', architecture: 'exhibit-left',
  exhibit: ['fact-grid', 'cards', 'flow', 'steps', 'paired', 'fact-grid', 'cards', 'table', 'chart.bar', 'flow'][i % 10], why: 'The exhibit this evidence takes, chosen' }));
const report = runPlanGates({ pages });
console.log(JSON.stringify({ mix: report.statistics.mix, codes: report.findings.filter((f) => f.code === 'PLAN_EXHIBIT_MIX').map((f) => [f.measured.family, f.measured.direction, f.severity]) }));
''')
        self.assertEqual(result["mix"]["numbers"], 0.4)
        self.assertEqual(result["mix"]["diagram"], 0.3)
        self.assertEqual(result["mix"]["mixed"], 0.1)
        self.assertIn(["numbers", "above", "advisory"], result["codes"])
        self.assertIn(["diagram", "above", "advisory"], result["codes"])
        self.assertIn(["chart", "below", "advisory"], result["codes"])
        self.assertLessEqual(CONTRACT["plan"]["mix"]["diagram"]["max"], 0.25)
        self.assertLessEqual(CONTRACT["plan"]["mix"]["numbers"]["max"], 0.25)


class CompiledMixTests(unittest.TestCase):
    def test_a_deck_short_of_charts_and_long_on_tables_is_refused_at_authoring(self):
        result = run_node(DECK + '''
import { varietyFindings, exhibitMix } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const forms = [['lookup', 'table', { type: 'table', rows: [['a']] }], ['numbers', 'fact-grid', { type: 'fact-grid', items: [] }],
  ['trend', 'line', chart('chart.line')], ['mechanism', 'flow', { type: 'flow' }], ['parallel', 'labelled-rows', null]];
const slides = Array.from({ length: 20 }, (_, i) => typed(i, ...(i < 8 ? forms[0] : forms[1 + (i % 4)])));
const mix = varietyFindings({ slides }).filter((f) => f.code.startsWith('VARIETY_EXHIBIT'));
console.log(JSON.stringify({ found: mix.map((f) => [f.code, f.measured.family ?? null, f.measured.direction ?? null, f.severity]),
  shares: Object.fromEntries(Object.entries(exhibitMix(slides).families).map(([k, v]) => [k, v.share])) }));
''')
        self.assertIn(["VARIETY_EXHIBIT_MIX", "table", "above", "blocker"], result["found"])
        self.assertIn(["VARIETY_EXHIBIT_MIX", "chart", "below", "blocker"], result["found"])
        self.assertEqual(result["shares"]["table"], 0.4)

    def test_the_range_counts_the_exhibits_drawn(self):
        result = run_node(DECK + '''
import { varietyFindings, exhibitMix } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const narrow = Array.from({ length: 20 }, (_, i) => typed(i, 'ranking', 'bar', chart()));
const wide = Array.from({ length: 20 }, (_, i) => typed(i, 'ranking', 'bar', chart(['chart.bar', 'chart.line', 'chart.column', 'chart.dumbbell', 'chart.waffle', 'chart.scatter', 'chart.slope', 'chart.donut'][i % 8])));
const range = (slides) => varietyFindings({ slides }).find((f) => f.code === 'VARIETY_EXHIBIT_RANGE') ?? null;
console.log(JSON.stringify({ narrow: range(narrow)?.measured ?? null, wide: range(wide), perTen: exhibitMix(wide).perTen }));
''')
        self.assertEqual(result["narrow"]["distinct"], 1)
        self.assertEqual(result["narrow"]["perTen"], 0.5)
        self.assertIsNone(result["wide"])
        self.assertEqual(result["perTen"], 4.0)
        self.assertEqual(CONTRACT["plan"]["craft"]["exhibitVarietyPerTen"]["min"], 4.0)

    def test_a_revision_under_older_rules_hears_the_mix_as_advice(self):
        result = run_node(DECK + '''
import { varietyFindings } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const slides = Array.from({ length: 20 }, (_, i) => typed(i, 'lookup', 'table', { type: 'table', rows: [['a']] }));
const sev = (extra) => varietyFindings({ slides, ...extra }).filter((f) => f.code.startsWith('VARIETY_EXHIBIT')).map((f) => f.severity);
console.log(JSON.stringify({ now: sev({}), older: sev({ workflow: 'existing_deck_revision', rulesVersion: 2 }) }));
''')
        self.assertTrue(result["now"])
        self.assertEqual(set(result["now"]), {"blocker"})
        self.assertEqual(set(result["older"]), {"advisory"})


class PicturesWaiverTests(unittest.TestCase):
    def test_no_pictures_waives_photographs_and_nothing_else(self):
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
import { runPlanGates, photographsWaived } from './skills/professional-slides/runtime/gates/plan_gates.mjs';
const why = 'The subject is private company finance with nothing to photograph.';
const slides = Array.from({ length: 22 }, (_, i) => ({ id: 'p' + i, title: 'A finding on page ' + i, exhibit: { type: ['chart.line', 'chart.bar', 'table', 'flow'][i % 4] } }));
const scene = { slides: slides.map(() => ({ nodes: [{ role: 'action-title' }], componentInstances: [] })) };
const codes = (spec) => craftFindings(spec, scene).map((f) => f.code).sort();
const plan = (noPictures) => runPlanGates({ noPictures, pages: Array.from({ length: 10 }, (_, i) => ({ n: i, title: 'A page that states a measurable thing', exhibit: 'chart.bar', architecture: 'exhibit-left', why: 'magnitude compared across peers' })) });
console.log(JSON.stringify({ bare: codes({ slides, players: ['One', 'Two', 'Three'] }), waived: codes({ slides, players: ['One', 'Two', 'Three'], noPictures: why }),
  plan: plan(undefined).findings.map((f) => f.code).sort(), planWaived: plan(why).findings.map((f) => f.code).sort(),
  helper: [photographsWaived({ noPictures: why }), photographsWaived({ noPictures: 'none' }), photographsWaived({})] }));
''')
        self.assertIn("CRAFT_NO_PICTURES", result["bare"])
        self.assertNotIn("CRAFT_NO_PICTURES", result["waived"])
        for code in ("CRAFT_NO_ICONS", "CRAFT_PLAYERS_UNINTRODUCED"):
            self.assertIn(code, result["waived"], f"noPictures must not waive {code}")
        self.assertIn("PLAN_NO_PICTURES", result["plan"])
        self.assertNotIn("PLAN_NO_PICTURES", result["planWaived"])
        self.assertIn("PLAN_NO_ICONS", result["planWaived"])
        self.assertEqual(result["helper"], [True, False, False])


class CraftFloorSourceTests(unittest.TestCase):
    def test_the_built_decks_floors_are_the_contracts(self):
        craft = CONTRACT["plan"]["craft"]
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: 'Page ' + i, exhibit: { type: 'table', columns: ['A'], rows: [['x']] } }));
const scene = (treated) => ({ slides: Array.from({ length: 12 }, (_, i) => ({ nodes: [{ role: 'action-title' }, { role: i < treated ? 'table-bar' : 'table-cell' }], componentInstances: [{ component: 'slide-chrome' }, { component: 'table' }] })) });
const plain = (n) => craftFindings({ slides }, scene(n)).find((f) => f.code === 'CRAFT_TABLES_PLAIN') ?? null;
console.log(JSON.stringify({ five: plain(5), six: plain(6) }));
''')
        # A table headed by the players' marks is a table read by them: the
        # gate's own repair asks for exactly that. Every page carries its
        # chrome, so the first is a content page and all twelve are counted.
        logos = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: 'Page ' + i, exhibit: { type: 'table', columns: ['A'], rows: [['x']] } }));
const scene = { slides: Array.from({ length: 12 }, (_, i) => ({ nodes: [{ role: 'action-title' }, { role: i < 6 ? 'table-header-logo' : 'table-cell' }], componentInstances: [{ component: 'slide-chrome' }, { component: 'table' }] })) };
console.log(JSON.stringify(craftFindings({ slides }, scene).some((f) => f.code === 'CRAFT_TABLES_PLAIN')));
''')
        self.assertFalse(logos)
        # Five of twelve treated is under the built deck's floor, six is not.
        self.assertIsNotNone(result["five"])
        self.assertEqual(result["five"]["threshold"], craft["tableTreated"]["blockBelow"])
        self.assertIsNone(result["six"])
        self.assertLess(craft["tableTreated"]["blockBelow"], craft["tableTreated"]["min"])
        self.assertLess(craft["chartAnnotated"]["blockBelow"], craft["chartAnnotated"]["min"])


class ContentCeilingTests(unittest.TestCase):
    def run_content(self, qualitative, pages=10, answer="Adopt the regional hub plan within two years"):
        return run_node(f'''
import {{ runContentGates }} from './skills/professional-slides/runtime/gates/content_gates.mjs';
const CLAIMS = ['Adopt the regional hub plan within two years to hold share', 'Cargo yields fell below the operating breakeven in autumn',
  'Lisbon connections doubled after the slot swap', 'Fleet utilisation peaked during the summer schedule',
  'Premium cabins carried most of the margin gain', 'Fuel hedges cushioned the spring price spike',
  'Crew rostering limited weekend frequencies sharply', 'Partner codeshares filled thin transatlantic routes',
  'Maintenance downtime clustered around older narrowbodies', 'Airport charges rose faster than ticket prices'];
const pages = Array.from({{ length: {pages} }}, (_, i) => ({{ n: i + 1, id: 'p' + i,
  claim: CLAIMS[i],
  settles: {{ kind: i < {qualitative} ? 'qualitative' : 'count', what: 'Observed figures for route ' + i }}, adds: null, highlight: i === 0 ? 'regional hub' : '' }}));
const deck = (d) => runContentGates({{ question: 'What should the network do?', answer: {json.dumps(answer)}, pages }}, {{ deck: d }});
const pick = (r) => r.findings.filter((f) => f.code.startsWith('CONTENT_')).map((f) => [f.code, f.severity]);
console.log(JSON.stringify({{ now: pick(deck({{}})), accepted: deck({{}}).accepted,
  older: pick(deck({{ workflow: 'existing_deck_revision', rulesVersion: 2 }})), olderAccepted: deck({{ workflow: 'existing_deck_revision', rulesVersion: 2 }}).accepted }}));
''')

    def test_unmeasured_evidence_past_half_the_deck_blocks(self):
        mild = self.run_content(qualitative=4)
        self.assertIn(["CONTENT_UNMEASURED", "advisory"], mild["now"])
        heavy = self.run_content(qualitative=6)
        self.assertIn(["CONTENT_UNMEASURED", "blocking"], heavy["now"])
        self.assertFalse(heavy["accepted"])
        self.assertIn(["CONTENT_UNMEASURED", "advisory"], heavy["older"])
        self.assertTrue(heavy["olderAccepted"])

    def test_an_answer_no_page_carries_blocks_a_deck_long_enough_to_judge(self):
        uncarried = self.run_content(qualitative=0, answer="Divest the cargo arm and lease freighters from partners")
        self.assertIn(["CONTENT_ANSWER_UNCARRIED", "blocking"], uncarried["now"])
        self.assertIn(["CONTENT_ANSWER_UNCARRIED", "advisory"], uncarried["older"])
        probe = self.run_content(qualitative=0, pages=3, answer="Divest the cargo arm and lease freighters from partners")
        self.assertIn(["CONTENT_ANSWER_UNCARRIED", "advisory"], probe["now"])
        carried = self.run_content(qualitative=0)
        self.assertNotIn("CONTENT_ANSWER_UNCARRIED", [code for code, _ in carried["now"]])


if __name__ == "__main__":
    unittest.main()
