"""The authoring contract: what author-deck.mjs holds a pages file to, and when.

Seventy of one deck's 107 author runs failed, most on rules the author met
only by failing - a point with no marked phrase, a page type its data could
not carry, a draft refused for its exhibits before its copy existed - while
the same deck stamped `adds: null` on every page, answered two of its three
questions with titles about what the evidence could not settle, and still
compiled. These tests hold the other side: the spine is checked in a draft,
the copy in the full compile, and metadata that says nothing true is refused.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"
EXAMPLE = ROOT / "skills" / "professional-slides" / "examples" / "page-types.pages.json"

PAGE = """
const S = { kind: 'comparison', what: 'Company filings and press reports, 2025 to 2026' };
const base = { takeaway: false, why: 'The page compares the two firms on the same terms', settles: S, adds: 'The commentary names what the exhibit cannot: the terms behind each figure' };
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
"""

PAGES = f"""
import fs from 'node:fs';
import {{ compilePage, pageSchema }} from '{KIT}';
import {{ compileDeck, scaffoldPage, insightTypes }} from '{AUTHOR}';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const pageOf = (id) => structuredClone([...example.pages, ...(example.appendix || [])].find((p) => p.id === id));
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
// A page drafted: the one compile of the page completed with placeholder copy. Its refusal, or null where the draft takes it.
const drafted = (page) => compileDeck({{ deck: {{ id: 'd' }}, pages: [page] }}, {{ draft: true, partial: true }});
const draftError = (page) => drafted(page).compileErrors[0] ?? null;
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const trend = (extra = {{}}) => ({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', why: 'The break is the claim and sits where it happens',
  settles: {{ kind: 'rate', what: 'Journeys by year from the operator reports' }}, adds: 'The callouts say why the line broke and why it has not recovered',
  title: 'Journeys fell by four fifths and have not recovered', exhibit: {{ categories: years, series: [{{ name: 'Journeys', values: [5, 1, 2, 4, 5, 6, 6, 7] }}],
  annotations: [{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}] }}, ...extra }});
"""


def author(*args, env=None, cwd=None):
    return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), *args], capture_output=True, text=True,
                          env={**os.environ, **(env or {})}, cwd=cwd or ROOT, timeout=240)


@unittest.skipUnless(NODE, "Node.js is not available")
class PageMetadataTests(unittest.TestCase):
    def test_takeaway_and_adds_are_optional_where_they_say_nothing(self):
        result = run_node(PAGES + """
const plain = pageOf('p26'); delete plain.adds;
const rail = compilePage(trend({ commentary: 'rail', adds: undefined, rail: 'Traffic fell to a fifth in 2020 and is still below its old level six years on' }));
const bar = compilePage(trend({ commentary: 'so-what-bar', adds: undefined, bar: 'The recovery stalled, so growth has to come from new off-peak riders', exhibit: { ...trend().exhibit, annotations: [], highlights: [{ category: '2020' }] } }));
console.log(JSON.stringify({
  plain: compilePage(plain).pageType.content, rail: rail.pageType.content.adds, bar: bar.pageType.content.adds,
  noAdds: error(() => compilePage(trend({ adds: undefined }))), nullAdds: error(() => compilePage(trend({ adds: null }))),
  draftNoAdds: draftError(trend({ adds: undefined })),
  qualitative: error(() => compilePage(trend({ settles: { kind: 'qualitative', what: 'The operator statement of its plan' } }))),
  tableQualitative: error(() => compilePage({ ...pageOf('p08'), settles: { kind: 'qualitative', what: 'The operator statement of its plan' } })),
  matrixQualitative: error(() => compilePage({ ...pageOf('p13'), settles: { kind: 'qualitative', what: 'What riders told the surveys' } })),
}));
""")
        self.assertIsNone(result["plain"]["adds"])  # absent is none, on a page with no commentary
        self.assertEqual(result["rail"], "Traffic fell to a fifth in 2020 and is still below its old level six years on")
        self.assertTrue(result["bar"].startswith("The recovery stalled"))  # a rail or a bar is its own answer
        self.assertIn("say in `adds` what the callouts say", result["noAdds"])
        self.assertIn("`adds: null` says they add nothing", result["nullAdds"])
        self.assertIsNone(result["draftNoAdds"])  # the copy is the full compile's: a draft stands in for it
        self.assertIn('not settled by a "qualitative" judgement', result["qualitative"])
        self.assertIn("tabulates", result["tableQualitative"])
        self.assertIsNone(result["matrixQualitative"])  # a findings matrix may rest on statements

    def test_a_source_registry_is_cited_by_key(self):
        result = run_node(PAGES + """
const sources = { reports: { name: 'Northvale Rail annual reports, FY19-FY26', url: 'https://example.org/reports' },
  survey: { name: 'Passenger survey FY26', status: 'operator survey' } };
console.log(JSON.stringify({
  cited: compilePage(trend({ source: ['reports', 'survey'] }), 0, { sources }).source,
  one: compilePage(trend({ source: ['reports'] }), 0, { sources }).source,
  unknown: error(() => compilePage(trend({ source: ['annual'] }), 0, { sources })),
  noRegistry: error(() => compilePage(trend({ source: ['reports'] }))),
  bad: error(() => compileDeck({ deck: { id: 'd' }, sources: { a: { url: 'x' } }, pages: [] })),
}));
""")
        self.assertEqual(result["cited"], "Sources: Northvale Rail annual reports, FY19-FY26; Passenger survey FY26 (operator survey)")
        self.assertEqual(result["one"], "Source: Northvale Rail annual reports, FY19-FY26")
        self.assertIn('"annual"', result["unknown"])
        self.assertIn("its keys are reports, survey", result["unknown"])
        self.assertIn("no `sources` registry", result["noRegistry"])
        self.assertIn("needs its `name`", result["bad"])

    def test_a_shape_mismatch_names_the_types_the_evidence_can_carry(self):
        result = run_node(PAGES + """
const insights = new Map([['i1', { id: 'i1', shape: 'series', finding: 'Journeys fell', strength: 'strong' }], ['i2', { id: 'i2', shape: 'qualitative', finding: 'Riders cite the wait', strength: 'supporting' }]]);
const ranking = { ...pageOf('p13b'), evidence: ['i1'] }; delete ranking.settles;
const scorecard = { ...pageOf('p12'), evidence: ['i2'] }; delete scorecard.settles;
console.log(JSON.stringify({ mismatch: error(() => compilePage(ranking, 0, { insights })), types: insightTypes(insights),
  scorecard: compilePage(scorecard, 0, { insights }).pageType.content.settles.kind }));
""")
        self.assertIn("series carries trend, numbers, panels, lookup", result["mismatch"])
        self.assertIn("any shape carries", result["mismatch"])
        self.assertEqual(result["types"]["i1 (series)"], "trend, numbers, panels, lookup")
        self.assertEqual(result["scorecard"], "comparison")  # a scorecard of judgements is settled by its comparison


@unittest.skipUnless(NODE, "Node.js is not available")
class SpineRulesTests(unittest.TestCase):
    def test_gap_titles_generated_metadata_and_the_request_are_spine_rules(self):
        result = run_node(PAGES + """
const base = example.pages.filter((p) => p.type).slice(0, 20);
const gapped = base.map((p, i) => (i < 5 ? { ...p, title: 'The comparison remains unproven on public evidence, case ' + i } : p));
const once = base.map((p, i) => (i < 1 ? { ...p, title: 'Long-run leadership cannot be ranked without matched retention' } : p));
const stamped = base.map((p) => ({ ...p, why: 'Chosen because it fits the claim on this page' }));
const codes = (doc) => compileDeck(doc, { draft: true, partial: true }).spineFindings.map((f) => f.code);
const deck = (extra = {}) => ({ ...example.deck, ...extra });
const gap = compileDeck({ deck: deck(), pages: gapped }, { draft: true, partial: true }).spineFindings.find((f) => f.code === 'TITLE_GAP_SHARE');
console.log(JSON.stringify({
  gapped: codes({ deck: deck(), pages: gapped }), once: codes({ deck: deck(), pages: once }), stamped: codes({ deck: deck(), pages: stamped }),
  gapRepair: gap?.repair ?? '',
  newDeck: codes({ deck: deck({ workflow: 'new_deck', request: undefined }), pages: base }),
  asked: codes({ deck: deck({ workflow: 'new_deck', request: 'Make me a deck on whether Northvale can reach 60 million journeys' }), pages: base }),
  waivers: codes({ deck: deck({ waivers: [{ code: 'BAR_EXHIBIT_VARIETY' }] }), pages: base }),
  // A waiver names a build bar (build-bars.mjs BUILD_BAR_CODES), not any gate's code.
  notABar: codes({ deck: deck({ waivers: [{ code: 'VARIETY_PANELS', reason: 'A board update of eleven pages has one comparison to draw' }] }), pages: base }),
  waived: codes({ deck: deck({ waivers: [{ code: 'BAR_EXHIBIT_VARIETY', reason: 'A board update of eleven pages has one comparison to draw' }] }), pages: base }),
}));
""")
        self.assertEqual(result["gapped"], ["TITLE_GAP_SHARE"])
        self.assertEqual(result["once"], [])  # "cannot rank" once, naming what would settle it, is an answer
        self.assertIn("storylining.md#answer-under-uncertainty", result["gapRepair"])
        self.assertIn("subtitle", result["gapRepair"])
        self.assertEqual(result["stamped"], ["GENERATOR_SIGNATURE"])
        self.assertEqual(result["newDeck"], ["REQUEST_MISSING"])
        self.assertEqual(result["asked"], [])
        self.assertEqual(result["waivers"], ["WAIVERS_INVALID"])
        self.assertEqual(result["notABar"], ["WAIVERS_INVALID"])
        self.assertEqual(result["waived"], [])

    def test_a_pillar_rests_on_a_strong_insight(self):
        result = run_node(PAGES + """
const shape = (id, strength) => ({ id, shape: 'series', breadth: { periods: 8 }, finding: 'x', strength, soWhat: 'It decides the order of the plan',
  measures: { level: { unit: 'routes', population: 'the operator', periods: ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], values: [1, 2, 3, 4, 5, 6, 7, 8] } } });
const pages = [{ kind: 'section', id: 's1', title: 'Demand' }, { ...trend({ id: 'a' }), evidence: ['i1'] }, { kind: 'section', id: 's2', title: 'Supply' }, { ...trend({ id: 'b' }), evidence: ['i2'] }];
const codes = (insights) => compileDeck({ deck: { id: 'd' }, pages }, { insights, draft: true, partial: true }).spineFindings;
const weak = codes(new Map([['i1', shape('i1', 'strong')], ['i2', shape('i2', 'context')]]));
console.log(JSON.stringify({ weak: weak.map((f) => [f.code, f.pages]), strong: codes(new Map([['i1', shape('i1', 'strong')], ['i2', shape('i2', 'strong')]])).length }));
""")
        self.assertEqual(result["weak"], [["PILLAR_UNSUPPORTED", ["Supply"]]])
        self.assertEqual(result["strong"], 0)

    def test_a_draft_refuses_the_exhibit_the_full_compile_refuses_and_defers_only_the_copy(self):
        # A trend drawn over two periods is refused by the full compile under every form of the type. A draft used to keep
        # the page with that refusal recorded "for the full compile", and the critique was then bound to a page that could
        # not be laid out as it stood. A draft is the full compile of the page completed: it refuses the page too.
        result = run_node(PAGES + """
const thin = trend({ exhibit: { categories: ['2019', '2020'], series: [{ name: 'x', values: [1, 2] }], annotations: [{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }] } });
const refused = drafted(thin), noCopy = drafted(trend({ adds: undefined, exhibit: { ...trend().exhibit, annotations: undefined } }));
console.log(JSON.stringify({ refused: refused.failed.map((f) => [f.code, f.message]), slides: refused.spec.slides.length,
  pending: noCopy.spec.slides[0]?.pageType.pending, errors: noCopy.compileErrors, type: noCopy.spec.slides[0]?.pageType.type, callouts: noCopy.spec.slides[0]?.exhibit.annotations ?? null,
  full: error(() => compilePage(thin)), spineTitle: draftError(trend({ title: 'one two three four five six seven eight nine ten eleven twelve thirteen' })),
  spineType: draftError(trend({ form: 'pie' })) }));
""")
        self.assertEqual([code for code, _ in result["refused"]], ["SPINE_UNDRAWABLE"])
        self.assertIn("four or more periods", result["refused"][0][1])
        self.assertIn("No form of a trend page holds the exhibit the spine draws here", result["refused"][0][1])
        self.assertEqual(result["slides"], 0)
        self.assertIn("four or more periods", result["full"])
        # What a draft defers is the copy: the page with no callouts and no `adds` compiles, says so, and carries none of the copy stood in for it.
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["pending"], ["copy"])
        self.assertEqual(result["type"], "trend")
        self.assertIsNone(result["callouts"])
        self.assertIn("TITLE_WORDS", result["spineTitle"])  # the spine's own rules hold in a draft
        self.assertIn("choose `form`", result["spineType"])


@unittest.skipUnless(NODE, "Node.js is not available")
class ScaffoldAndSchemaTests(unittest.TestCase):
    def test_every_type_scaffolds_to_a_page_that_compiles(self):
        result = run_node(PAGES + """
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
const out = {};
for (const type of Object.keys(PAGE_TYPES)) out[type] = error(() => compilePage(scaffoldPage(type, { id: 'x' })));
const insight = { id: 'i-journeys', shape: 'series', breadth: { periods: 8 }, finding: 'Journeys fell', strength: 'strong',
  data: { categories: ['FY19','FY20','FY21','FY22','FY23','FY24','FY25','FY26'], series: [{ name: 'Journeys', values: [52, 40, 21, 38, 44, 46, 47, 48] }] } };
const scaffold = scaffoldPage('trend', { insight });
const compiled = compilePage(scaffold, 0, { insights: new Map([[insight.id, insight]]) });
console.log(JSON.stringify({ out, evidence: scaffold.evidence, settles: compiled.pageType.content.settles.kind, categories: scaffold.exhibit.categories,
  wrong: error(() => scaffoldPage('ranking', { insight })), trendSchema: pageSchema('trend').properties.type.const, unknown: error(() => pageSchema('chart')) }));
""")
        self.assertEqual({k: v for k, v in result["out"].items() if v}, {})
        self.assertEqual(result["evidence"], ["i-journeys"])
        self.assertEqual(result["settles"], "rate")  # derived from the insight's shape
        self.assertEqual(result["categories"][0], "FY19")  # the insight's data is in the exhibit
        self.assertIn("ranking page cannot rest on", result["wrong"])
        self.assertEqual(result["trendSchema"], "trend")
        self.assertIn("unknown page type", result["unknown"])

    def test_the_schema_is_written_whole_through_a_pipe(self):
        # console.log then process.exit cut the schema at 64 KB when piped.
        full = subprocess.run(f'"{NODE}" "{RUNTIME / "author-deck.mjs"}" --schema | cat', shell=True, capture_output=True, text=True, cwd=ROOT, timeout=120)
        schema = json.loads(full.stdout)
        self.assertGreater(len(full.stdout), 65536)
        self.assertIn("sources", schema["properties"])
        one = json.loads(author("--schema", "ranking").stdout)
        self.assertEqual(one["properties"]["type"]["const"], "ranking")
        self.assertNotIn("takeaway", one["required"])
        scaffold = author("--scaffold", "panels")
        self.assertEqual(scaffold.returncode, 0, scaffold.stderr)
        self.assertEqual(json.loads(scaffold.stdout)["type"], "panels")
        example = author("--example", "bridge")
        self.assertEqual(json.loads(example.stdout)[0]["type"], "bridge")


@unittest.skipUnless(NODE, "Node.js is not available")
class RevisionAuthoringTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        example = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        self.mapped = next(p for p in example["pages"] if p.get("id") == "p03")
        self.deck = {"schema": "professional-slides.deck/v3", "id": "rev", "workflow": "existing_deck_revision", "inventory": "rev.inventory.json",
                     "design": "consulting", "brief": "Can Northvale Rail grow to 60 million journeys by FY31?",
                     "answer": "Journeys recovered to 48 million but stalled 4 million below the peak", "cover": {"title": "Northvale Rail"}}
        (self.dir / "rev.inventory.json").write_text(json.dumps({"schema": "professional-slides.inventory/v1", "id": "rev", "slides": []}))

    def write(self, pages):
        path = self.dir / "rev.pages.json"
        path.write_text(json.dumps({"deck": self.deck, "pages": pages}))
        return str(path)

    def test_unmapped_slides_are_a_draft_advisory_and_a_full_compile_refusal(self):
        unmapped = {"id": "s03", "sourceSlide": 3, "title": "Old title", "draft": {"text": ["An old bullet"]}}
        mapped = {**self.mapped, "id": "s02", "sourceSlide": 2}
        draft = author(self.write([mapped, unmapped]), "--draft", "--check")
        self.assertEqual(draft.returncode, 0, draft.stderr)
        self.assertIn("REVISION_UNMAPPED", draft.stdout)
        full = author(self.write([mapped, unmapped]), "--check")
        self.assertEqual(full.returncode, 2)
        self.assertIn("REVISION_UNMAPPED", full.stderr)
        self.assertIn("s03", full.stderr)
        # A new deck carries no imported copy.
        self.deck["workflow"] = "new_deck"
        self.deck["request"] = "Rebuild the growth plan deck for the board"
        refused = author(self.write([mapped, unmapped]), "--draft", "--check")
        self.assertEqual(refused.returncode, 2)
        self.assertIn("only a revision", refused.stderr)

    def test_the_plan_records_the_inventory_and_each_page_source_slide(self):
        result = run_node(f"""
import {{ compileDeck, planOf }} from '{AUTHOR}';
const page = {json.dumps({**self.mapped, "id": "s02", "sourceSlide": 2})};
const {{ spec }} = compileDeck({{ deck: {json.dumps(self.deck)}, pages: [page] }});
const plan = planOf(spec);
console.log(JSON.stringify({{ workflow: plan.workflow, inventory: plan.inventory, source: plan.pages.find((p) => p.id === 's02').sourceSlide,
  deckInventory: spec.inventory, rules: spec.rulesVersion, draftKey: 'draft' in spec.slides[0] }}));
""")
        self.assertEqual(result["workflow"], "existing_deck_revision")
        self.assertEqual(result["inventory"], "rev.inventory.json")
        self.assertEqual(result["source"], 2)
        self.assertEqual(result["deckInventory"], "rev.inventory.json")
        self.assertFalse(result["draftKey"])
        self.assertIsNotNone(result["rules"])  # stamped with the rules version it was authored under

    def test_page_gates_that_cannot_run_are_said_aloud(self):
        mapped = {**self.mapped, "id": "s02", "sourceSlide": 2}
        run = author(self.write([mapped]), "--draft", "--check", env={"RUNTIME_PYTHON": str(self.dir / "no-python")})
        self.assertIn("page gates did not run", run.stderr)
        self.assertIn("doctor.mjs", run.stderr)


@unittest.skipUnless(NODE, "Node.js is not available")
class DensityFloorTests(unittest.TestCase):
    def test_a_live_pitch_deck_is_held_to_scaled_floors(self):
        result = run_node("""
import { wordBudgetOf, DENSITY_FLOOR_SCALE } from './skills/professional-slides/runtime/derive-content.mjs';
import { READING_TASK_BANK } from './skills/professional-slides/runtime/text-contract.mjs';
const tasks = Object.keys(READING_TASK_BANK);
console.log(JSON.stringify({ pitch: Math.max(...tasks.map((t) => wordBudgetOf(t, null, 'live-pitch').floor)),
  executive: wordBudgetOf('table-with-commentary', null, 'executive').floor, none: wordBudgetOf('table-with-commentary').floor,
  preRead: wordBudgetOf('chart-led', null, 'pre-read').floor, scale: DENSITY_FLOOR_SCALE }));
""")
        self.assertLess(result["pitch"], 40)  # a presented page carries about forty body words or fewer
        self.assertEqual(result["executive"], result["none"])
        self.assertEqual(result["preRead"], 42)


class DeckFindingTests(unittest.TestCase):
    """What authoring reads across the deck: table monotony and players never shown."""

    def deck(self, extra):
        return run_node(f'''
import {{ compileDeck }} from '{AUTHOR}';
{PAGE}
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const chart = {{ type: 'trend', form: 'line', commentary: 'on-exhibit', exhibit: {{ categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8] }}, {{ name: 'y', values: [2, 3, 4, 5, 6, 7, 8, 9] }}],
  annotations: [{{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }}] }} }};
const table = {{ type: 'lookup', form: 'table', commentary: 'none', exhibit: {{ columns: [{{ label: 'Item', type: 'category' }}, 'OpenAI', 'Anthropic'], rows: [['A', 'x', 'y'], ['B', 'x', 'y'], ['C', 'x', 'y']] }} }};
const coded = {{ type: 'scorecard', form: 'harvey', commentary: 'in-exhibit', exhibit: {{ columns: ['Option', {{ label: 'Fit', type: 'harvey' }}], rows: [['A', {{ type: 'harvey', value: 2 }}], ['B', {{ type: 'harvey', value: 3 }}], ['C', {{ type: 'harvey', value: 1 }}]] }} }};
const logos = {{ type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', exhibit: {{ columns: [{{ label: '', type: 'logo' }}, 'Firm', 'Users'],
  rows: [[{{ media: {{ alt: 'OpenAI logo' }} }}, 'OpenAI', '1bn'], [{{ media: {{ alt: 'Anthropic logo' }} }}, 'Anthropic', 'n/a'], [{{ media: {{ alt: 'Google logo' }} }}, 'Google', 'n/a']] }} }};
const cards = {{ type: 'profiles', form: 'cards', commentary: 'none', exhibit: {{ items: [{{ title: 'ChatGPT', text: 'The consumer assistant' }}, {{ title: 'Claude', text: 'The enterprise assistant' }}] }} }};
const make = (kinds, titles = []) => kinds.map((k, i) => ({{ id: 'c' + i, ...base, title: titles[i] ?? 'Finding number ' + i + ' of the deck', ...structuredClone(k) }}));
{extra}
''')

    def test_table_monotony_is_found_in_a_window_and_a_mixed_deck_passes(self):
        """Fifty-page review: sixteen pages of one table construction."""
        result = self.deck('''
const run = [chart, table, table, table, chart, table, table, table, chart, chart, coded, chart];
const mixed = [chart, table, chart, coded, table, chart, coded, table, chart, coded, table, chart];
const find = (kinds) => compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages: make(kinds) }).findings.find((f) => f.code === 'VARIETY_TABLES') ?? null;
console.log(JSON.stringify({ run: find(run), mixed: find(mixed) }));
''')
        self.assertEqual(result["run"]["measured"]["pages"], 6)
        self.assertEqual(result["run"]["measured"]["construction"], "filled first column · text cells · short · open foot")
        self.assertIn("bridge", result["run"]["repair"])
        self.assertIsNone(result["mixed"])

    def test_named_players_need_their_marks_early(self):
        """Fifty-page review: two named players with no logo anywhere near the front."""
        result = self.deck('''
const kinds = [chart, coded, chart, coded, chart, coded, chart, coded, chart, coded, chart, coded];
const players = [{ name: 'OpenAI' }, { name: 'Anthropic' }];
const codes = (deck, pages) => compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd', ...deck }, pages }).findings.filter((f) => ['PLAYERS_UNMARKED', 'PROFILE_UNPICTURED'].includes(f.code));
const titled = make(kinds, kinds.map((_, i) => i % 2 ? 'OpenAI leads reach on measure ' + i : 'Anthropic leads spend on measure ' + i));
console.log(JSON.stringify({
  declared: codes({ players }, make(kinds)).map((f) => f.code),
  introduced: codes({ players }, make([chart, logos, ...kinds.slice(2)])).map((f) => f.code),
  late: codes({ players }, make([...kinds.slice(0, 6), logos, ...kinds.slice(7)])).map((f) => f.code),
  titles: codes({}, titled).map((f) => f.measured.players ?? f.code),
  unnamed: codes({}, make(kinds)).length,
  cards: codes({ players }, make([chart, logos, cards, ...kinds.slice(3)])).map((f) => f.code),
  aliased: codes({ players: [{ name: 'OpenAI Group', short: 'OpenAI' }, { name: 'Anthropic' }] }, make([chart, logos, ...kinds.slice(2)])).map((f) => f.code),
}));
''')
        self.assertEqual(result["declared"], ["PLAYERS_UNMARKED"])
        self.assertEqual(result["introduced"], [])
        self.assertEqual(result["late"], ["PLAYERS_UNMARKED"])
        self.assertEqual(sorted(result["titles"][0]), ["Anthropic", "OpenAI"])
        self.assertEqual(result["unnamed"], 0)
        self.assertEqual(result["cards"], ["PROFILE_UNPICTURED"])
        self.assertEqual(result["aliased"], [])  # a logo under the player's short name introduces it


if __name__ == "__main__":
    unittest.main()


SKILL_DIR = ROOT / "skills" / "professional-slides"


def anchors(path: Path) -> set[str]:
    """The GitHub-style anchors of a markdown file's headings."""
    import re
    out = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^#{1,6}\s+(.*)$", line)
        if m:
            out.add(re.sub(r"[^a-z0-9 -]", "", m.group(1).strip().lower()).replace(" ", "-"))
    return out


class InstructionsTests(unittest.TestCase):
    """The entry point is one pipeline, short, and every link in it lands."""

    def test_the_entry_point_is_short_and_its_links_resolve(self):
        import re
        text = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        description = re.search(r"^description: (.*)$", text, re.M).group(1)
        self.assertLessEqual(len(description), 600)
        self.assertLessEqual(len(text.splitlines()), 120)
        self.assertIn("runtime/doctor.mjs", text)  # step 0
        # Every runtime command the pipeline names is a file the skill ships.
        for command in sorted(set(re.findall(r"\bruntime/[\w./-]+\.(?:mjs|py)\b", text))):
            with self.subTest(command=command):
                self.assertTrue((SKILL_DIR / command).is_file(), command)
        for target, anchor in re.findall(r"\]\((references/[^)#]+)(?:#([^)]+))?\)", text):
            with self.subTest(link=f"{target}#{anchor}"):
                path = SKILL_DIR / target
                self.assertTrue(path.exists(), target)
                if anchor:
                    self.assertIn(anchor, anchors(path))
        # README and Production point at the one pipeline rather than restating it.
        self.assertIn("pipeline", anchors(SKILL_DIR / "SKILL.md"))
        for doc in (ROOT / "README.md", SKILL_DIR / "references" / "tools" / "production.md"):
            self.assertIn("SKILL.md#pipeline", doc.read_text(encoding="utf-8"))
            self.assertNotIn("--preflight\nnode", doc.read_text(encoding="utf-8"))

    def test_every_registered_template_has_the_sections_the_index_names(self):
        registry = json.loads((SKILL_DIR / "references" / "templates" / "registry.json").read_text(encoding="utf-8"))
        index = (SKILL_DIR / "references" / "templates" / "index.md").read_text(encoding="utf-8")
        sections = ["Mandate", "Decision question", "Page table", "Evidence", "Failure checks", "Acceptance check"]
        for sections_named in sections:
            self.assertIn(f"`{sections_named}`", index)
        for entry in registry["templates"]:
            with self.subTest(template=entry["id"]):
                text = (SKILL_DIR / "references" / "templates" / entry["file"]).read_text(encoding="utf-8")
                found = [line[3:].strip() for line in text.splitlines() if line.startswith("## ")]
                self.assertEqual(found, sections)
                self.assertIn(f"({entry['file']})", index)
        self.assertIn("competitive-position", [t["id"] for t in registry["templates"]])
