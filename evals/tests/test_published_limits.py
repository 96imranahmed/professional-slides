"""Every countable limit is published before a page is written.

A cold run learned its limits by violation: a title one word over on seven
pages, a subtitle past its line, a section too many for the contents page. The
catalogue commands now state them - `--scaffold` and `--example` on the page
they print, `--schema <type>` as `x-limits`, `--limits` for the deck - and
these tests hold each printed number to the constant its check reads, by
reading both from the runtime and by writing a page at the limit and one past
it. No number is written here.
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

RUNTIME = ROOT / "skills" / "professional-slides" / "runtime"
sys.path.insert(0, str(RUNTIME / "gates"))
import page_gates  # noqa: E402
import render_gates  # noqa: E402

CONTRACT = json.loads((RUNTIME / "weight.json").read_text(encoding="utf-8"))
TASKS = json.loads((RUNTIME / "reading-tasks.json").read_text(encoding="utf-8"))["tasks"]


def rounded(value):
    """Round half up, as the runtime's Math.round does (Python's round goes to even)."""
    return math.floor(value + 0.5)

LIMITS = '''
import fs from 'node:fs';
import { deckLimits, pageLimits } from './skills/professional-slides/runtime/limits.mjs';
import { PAGE_TYPES, LIMITS, TEXT_LIMITS, SUBTITLE_WORDS, COPY_LIMITS, CALLOUTS_MAX, EVIDENCE_FLOOR, FORM_COMMENTARY, compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { compileDeck, composeForAuthoring, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { CONTENT_THRESHOLDS } from './skills/professional-slides/runtime/gates/content_gates.mjs';
import { AGENDA_LIMITS } from './skills/professional-slides/runtime/panels.mjs';
import { FOOTER_LINES_MAX } from './skills/professional-slides/runtime/page-template.mjs';
import { SECTION_TITLE_LINES } from './skills/professional-slides/runtime/registry-chrome.mjs';
import { PICTURE_SHARE_MAX } from './skills/professional-slides/runtime/weight.mjs';
const dir = './skills/professional-slides/examples';
const examples = workedExamples();
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const words = (n) => Array.from({ length: n }, (_, i) => ['fares', 'rose', 'while', 'journeys', 'fell', 'across', 'every', 'line', 'this', 'year'][i % 10]).join(' ');
'''


def author(*args, cwd=ROOT):
    return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), *args], capture_output=True, text=True, cwd=cwd, timeout=180)


class PublishedLimitTests(unittest.TestCase):
    def test_each_copy_limit_is_the_constant_its_gate_reads(self):
        result = run_node(LIMITS + '''
console.log(JSON.stringify({ deck: deckLimits(), constants: { title: TEXT_LIMITS, subtitle: SUBTITLE_WORDS, footer: FOOTER_LINES_MAX, section: SECTION_TITLE_LINES,
  agenda: AGENDA_LIMITS, content: CONTENT_THRESHOLDS } }));
''')
        deck, constants = result["deck"], result["constants"]
        # The page gates' own numbers (Python) and the weight contract's.
        self.assertEqual(deck["title"]["words"]["max"], page_gates.THRESHOLDS["title_words_max"])
        self.assertEqual(deck["title"]["words"]["max"], CONTRACT["plan"]["titleWords"]["max"])
        self.assertEqual(deck["title"]["lines"]["max"], page_gates.THRESHOLDS["title_lines_max"])
        self.assertEqual(deck["takeaway"]["lines"]["max"], render_gates.TAKEAWAY_LINES_MAX)
        self.assertEqual(deck["textBlock"]["words"]["max"], CONTRACT["plan"]["textForm"]["longestBlockMax"])
        # The compiler's, the composer's and the content gates'.
        self.assertEqual(deck["title"]["words"]["target"], constants["title"]["titleTarget"])
        self.assertEqual(deck["title"]["words"]["min"], constants["content"]["claimWordsMin"])
        self.assertEqual(deck["subtitle"], {"words": {"max": constants["subtitle"]}, "lines": {"max": constants["title"]["subtitleLines"]}})
        self.assertEqual(deck["source"]["lines"]["max"], constants["footer"])
        self.assertEqual(deck["note"]["lines"]["max"], constants["footer"])
        self.assertEqual(deck["sectionTitle"]["lines"]["max"], constants["section"])
        self.assertTrue(deck["sectionTitle"]["words"]["measured"])
        self.assertEqual(deck["contents"]["sections"], constants["agenda"])
        self.assertEqual(deck["answer"]["coverageByTitles"]["min"], constants["content"]["answerCoverageMin"])
        self.assertEqual(deck["answer"]["onTheOpeningPage"]["min"], constants["content"]["answerUpFrontMin"])
        self.assertEqual(deck["answer"]["leadingClauseInItsTitle"]["min"], constants["content"]["answerLeadMin"])

    def test_a_source_name_is_a_title_and_its_limit_is_published(self):
        # A sixty-word caveat written as a registry source's `name` was drawn
        # in the footer as a derived citation, which the note gates do not
        # count as the author's prose: the same words typed into `source` or
        # `note` are NOTE_HEAVY. A name is a title, held to a title's length.
        result = run_node(LIMITS + '''
import { registryProblems } from './skills/professional-slides/runtime/author-deck.mjs';
import { SOURCE_TITLE_WORDS } from './skills/professional-slides/runtime/page-template.mjs';
const page = (source) => ({ ...examples.pages.find((p) => p.type === 'trend'), source });
const compiled = (sources) => error(() => compileDeck({ deck: { ...examples.deck, workflow: undefined, rulesVersion: undefined }, sources, pages: [page(Object.keys(sources))] }));
const fixtures = './evals/quality/fixtures/evidence';
const longest = fs.readdirSync(fixtures).filter((f) => f.endsWith('.pages.json')).flatMap((f) => Object.values(JSON.parse(fs.readFileSync(`${fixtures}/${f}`, 'utf8')).sources ?? {}))
  .flatMap((entry) => [entry.name, entry.short].filter(Boolean)).reduce((n, text) => Math.max(n, text.split(/\\s+/).length), 0);
console.log(JSON.stringify({ limits: deckLimits().sources, constants: SOURCE_TITLE_WORDS, longest,
  atLimit: registryProblems({ a: { name: words(SOURCE_TITLE_WORDS.name), short: words(SOURCE_TITLE_WORDS.short) } }),
  name: registryProblems({ caveat: { name: words(SOURCE_TITLE_WORDS.name + 1) } }), short: registryProblems({ a: { name: 'Regional regulator annual returns 2026', short: words(SOURCE_TITLE_WORDS.short + 1) } }),
  status: registryProblems({ a: { name: 'Regional regulator annual returns 2026', status: words(SOURCE_TITLE_WORDS.status + 1) } }),
  statusAtLimit: registryProblems({ a: { name: 'Regional regulator annual returns 2026', status: words(SOURCE_TITLE_WORDS.status) } }),
  refusedStatus: compiled({ notes: { name: 'Team notes', status: words(63) } }),
  refused: compiled({ caveat: { name: words(61) } }), accepted: compiled({ report: { name: 'Northvale Rail annual report and accounts 2026', short: 'Annual report' } }) }));
''')
        self.assertEqual(result["limits"]["name"]["words"]["max"], result["constants"]["name"])
        self.assertEqual(result["limits"]["short"]["words"]["max"], result["constants"]["short"])
        # The bound leaves the evidence fixtures' own titles well inside it.
        self.assertTrue(0 < result["longest"] <= result["constants"]["short"] < result["constants"]["name"], result["longest"])
        self.assertEqual(result["atLimit"], [])
        self.assertEqual(len(result["name"]), 1)
        self.assertIn('`name` runs to 17 words', result["name"][0])
        self.assertIn("write it in the page's `note`, where it is counted (NOTE_HEAVY)", result["name"][0])
        self.assertIn('`short` runs to 9 words', result["short"][0])
        # A status is a label ("audited"), with a published limit of its own:
        # a caveat written there was drawn in the footer in full.
        self.assertEqual(result["limits"]["status"]["words"]["max"], result["constants"]["status"])
        self.assertLess(result["constants"]["status"], result["constants"]["short"])
        self.assertEqual(result["statusAtLimit"], [])
        self.assertIn(f'`status` runs to {result["constants"]["status"] + 1} words', result["status"][0])
        self.assertIn("the kind of record it is", result["status"][0])
        self.assertIn('`status` runs to 63 words', result["refusedStatus"])
        # The compile refuses the page file, so the prose never reaches a footer.
        self.assertIn('The `sources` registry is not valid', result["refused"])
        self.assertIn('`name` runs to 61 words', result["refused"])
        self.assertIsNone(result["accepted"])

    def test_the_word_budgets_are_the_reading_task_banks(self):
        result = run_node(LIMITS + '''
console.log(JSON.stringify({ executive: deckLimits().bodyWords, pitch: deckLimits({ density: 'live-pitch' }).bodyWords, summary: deckLimits().executiveSummary }));
''')
        self.assertEqual(set(result["executive"]), set(TASKS))
        for task, bank in TASKS.items():
            words = bank["bodyWords"]
            self.assertEqual(result["executive"][task]["min"], rounded(words["q1"]), task)
            self.assertEqual(result["executive"][task]["max"], rounded(words["q3"] + 1.5 * (words["q3"] - words["q1"])), task)
            # A live pitch is held to a quarter of the floor, and to the same ceiling.
            self.assertLess(result["pitch"][task]["min"], result["executive"][task]["min"], task)
            self.assertEqual(result["pitch"][task]["max"], result["executive"][task]["max"], task)
        self.assertEqual(result["summary"]["bodyWords"]["max"], rounded(TASKS["text-page"]["bodyWords"]["q3"]))

    def test_each_worked_page_is_composed_to_the_budget_its_limits_print(self):
        # The floor and ceiling a page's `limits` block prints are the ones the
        # composed page is held to: read off the scene, for every worked page.
        result = run_node(LIMITS + '''
const out = [];
for (const page of examples.pages.filter((p) => p.type)) {
  const { spec } = compileDeck({ deck: { ...examples.deck, workflow: undefined, rulesVersion: undefined }, pages: [page] });
  const composed = await composeForAuthoring(spec, dir);
  const slide = composed.deck.slides.find((s) => (s.sourceSlideId ?? s.id) === page.id);
  const printed = pageLimits(page.type, page.form, { commentary: page.commentary }).bodyWords[slide.readingTask] ?? null;
  out.push({ id: page.id, key: `${page.type}/${page.form}`, picture: page.type === 'picture', task: slide.readingTask, floor: slide.wordFloor, ceiling: slide.wordCeiling, printed });
}
console.log(JSON.stringify({ out, relief: 1 - PICTURE_SHARE_MAX }));
''')
        self.assertGreaterEqual(len(result["out"]), 94)
        for page in result["out"]:
            with self.subTest(page=page["id"], form=page["key"]):
                self.assertIsNotNone(page["printed"], f'{page["key"]} composes as {page["task"]}, which its limits do not print')
                self.assertEqual(page["printed"]["max"], page["ceiling"])
                if page["picture"]:
                    # A photograph stands in for words, by the share of the body it holds.
                    self.assertLessEqual(page["floor"], page["printed"]["min"])
                    self.assertGreaterEqual(page["floor"], rounded(page["printed"]["min"] * result["relief"]) - 1)
                else:
                    self.assertEqual(page["printed"]["min"], page["floor"])

    def test_every_form_prints_what_its_exhibit_holds(self):
        result = run_node(LIMITS + '''
const out = {};
for (const [type, t] of Object.entries(PAGE_TYPES)) for (const [form, target] of Object.entries(t.forms)) {
  const held = LIMITS[`${type}/${form}`] ?? LIMITS[target] ?? null, printed = pageLimits(type, form);
  out[`${type}/${form}`] = { held, exhibit: printed.exhibit ?? null, commentary: printed.commentary, allowed: FORM_COMMENTARY[`${type}/${form}`] ?? t.commentary,
    exhibits: printed.exhibits, count: Array.isArray(t.exhibits) ? t.exhibits : [t.exhibits, t.exhibits],
    plotted: printed.plottedValues?.min ?? null, periods: printed.periods?.min ?? null, members: printed.members?.min ?? null, type: { periods: t.periods ?? null, members: t.minCategories ?? null } };
}
console.log(JSON.stringify({ out, floor: EVIDENCE_FLOOR, copy: COPY_LIMITS, callouts: CALLOUTS_MAX, bar: TEXT_LIMITS.barLines,
  trend: pageLimits('trend', 'line'), panels: pageLimits('panels', 'row'), rows: pageLimits('parallel', 'labelled-rows'), argument: pageLimits('argument', 'memo') }));
''')
        self.assertEqual(len(result["out"]), 94)
        for key, form in result["out"].items():
            with self.subTest(form=key):
                held = form["held"]
                if held:
                    expected = {held["key"]: {"min": held["min"], **({"max": held["max"]} if held.get("max") else {})},
                                **({"valueCharacters": {"max": held["valueChars"]}} if held.get("valueChars") else {}),
                                # A grid's tiles across are a limit the compile holds too, printed with the rest.
                                **({"columns": {"min": 1, "max": held["columns"], "note": "tiles across; optional - left out, the grid sets them"}} if held.get("columns") else {})}
                    self.assertEqual(form["exhibit"], expected)
                else:
                    self.assertIsNone(form["exhibit"])
                self.assertEqual(form["commentary"], form["allowed"])
                self.assertEqual([form["exhibits"]["min"], form["exhibits"]["max"]], form["count"])
                self.assertEqual(form["periods"], form["type"]["periods"])
                self.assertEqual(form["members"], form["type"]["members"])
        self.assertEqual(result["out"]["trend/line"]["plotted"], result["floor"]["chart"])
        self.assertEqual(result["out"]["bridge/waterfall"]["plotted"], result["floor"]["bridge"])
        copy = result["copy"]
        self.assertEqual(result["trend"]["rail"]["words"]["min"], copy["railWordsMin"])
        self.assertEqual(result["trend"]["bar"], {"words": {"min": copy["barWordsMin"]}, "lines": {"max": result["bar"]}})
        self.assertEqual(result["trend"]["callouts"]["count"]["max"], result["callouts"])
        self.assertEqual(result["trend"]["callouts"]["wordsBetweenThem"]["min"], copy["calloutWordsMin"])
        self.assertEqual(result["panels"]["caption"]["words"]["min"], copy["captionWordsMin"])
        self.assertEqual(result["rows"]["blocks"], {"points": copy["blockPoints"], "labelWords": {"max": copy["blockLabelWords"]}})
        self.assertEqual(result["argument"]["panel"]["words"]["min"], copy["panelWordsMin"])

    def test_a_page_at_the_limit_compiles_and_one_past_it_is_refused(self):
        # The printed number is the one the compiler refuses on: written at it, the page compiles.
        result = run_node(LIMITS + '''
const chart = examples.pages.find((p) => p.type === 'trend' && p.form === 'line');
const limits = pageLimits('trend', 'line');
const titled = (n) => error(() => compilePage({ ...chart, title: words(n) }));
const subtitled = (n) => error(() => compilePage({ ...chart, subtitle: words(n) }));
const railed = (n) => error(() => compilePage({ ...chart, commentary: 'rail', adds: undefined, rail: words(n), exhibit: { ...chart.exhibit, annotations: chart.exhibit.annotations.slice(0, 1) } }));
const barred = (n) => error(() => compilePage({ ...chart, commentary: 'so-what-bar', adds: undefined, bar: words(n) }));
const called = (n) => error(() => compilePage({ ...chart, exhibit: { ...chart.exhibit, annotations: Array.from({ length: n }, (_, i) => ({ category: chart.exhibit.categories[i], text: 'A callout of seven words on this mark' })) } }));
const pie = examples.pages.find((p) => p.type === 'composition' && p.form === 'pie'), pieLimit = pageLimits('composition', 'pie').exhibit.labels;
const sliced = (n) => error(() => compilePage({ ...pie, exhibit: { ...pie.exhibit, labels: Array.from({ length: n }, (_, i) => `Part ${i + 1}`), values: Array.from({ length: n }, (_, i) => 40 - i) } }));
const stat = examples.pages.find((p) => p.form === 'stat-list'), chars = pageLimits('numbers', 'stat-list').exhibit.valueCharacters.max;
const valued = (n) => error(() => compilePage({ ...stat, exhibit: { items: stat.exhibit.items.map((item, i) => (i ? item : { ...item, value: '9'.repeat(n) })) } }));
const rows = examples.pages.find((p) => p.form === 'labelled-rows'), blockPoints = pageLimits('parallel', 'labelled-rows').blocks.points;
const pointed = (n) => error(() => compilePage({ ...rows, highlight: undefined, blocks: rows.blocks.map((block, i) => (i ? block : { ...block, points: Array.from({ length: n }, (_, k) => `Point ${k + 1} says what happened in this area this year`) })) }));
console.log(JSON.stringify({
  title: { at: titled(limits.title.words.max), over: titled(limits.title.words.max + 1) },
  subtitle: { at: subtitled(limits.subtitle.words.max), over: subtitled(limits.subtitle.words.max + 1) },
  rail: { at: railed(limits.rail.words.min), under: railed(limits.rail.words.min - 1) },
  bar: { at: barred(limits.bar.words.min), under: barred(limits.bar.words.min - 1) },
  callouts: { at: called(limits.callouts.count.max), over: called(limits.callouts.count.max + 1) },
  pie: { at: sliced(pieLimit.max), over: sliced(pieLimit.max + 1) },
  value: { at: valued(chars), over: valued(chars + 1) },
  points: { at: pointed(blockPoints.max), over: pointed(blockPoints.max + 1), under: pointed(blockPoints.min - 1) } }));
''')
        for name, case in result.items():
            with self.subTest(limit=name):
                self.assertIsNone(case["at"], f"{name}: a page written at the printed limit is refused: {case['at']}")
                for side in ("over", "under"):
                    if side in case:
                        self.assertTrue(case[side], f"{name}: a page {side} the printed limit compiles")
        self.assertIn("TITLE_WORDS", result["title"]["over"])
        self.assertIn("subtitle", result["subtitle"]["over"])


class LimitCommandTests(unittest.TestCase):
    def printed(self, *args):
        result = author(*args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def expected(self, call):
        return run_node(LIMITS + f"console.log(JSON.stringify({{ limits: {call} }}));")["limits"]

    def test_the_scaffold_of_every_type_carries_the_limits_of_the_page_it_prints(self):
        types = run_node(LIMITS + "console.log(JSON.stringify({ types: Object.keys(PAGE_TYPES) }));")["types"]
        for name in types:
            with self.subTest(type=name):
                page = self.printed("--scaffold", name)
                self.assertEqual(page["type"], name)
                self.assertEqual(page["limits"], self.expected(f"pageLimits({json.dumps(name)}, {json.dumps(page['form'])}, {{ commentary: {json.dumps(page['commentary'])} }})"))
                self.assertEqual(list(page)[-1], "limits")  # the block closes the page, after its content

    def test_an_example_page_carries_its_limits_and_the_schema_its_types(self):
        [page] = self.printed("--example", "composition/pie")
        self.assertEqual(page["limits"], self.expected(f"pageLimits('composition', 'pie', {{ commentary: {json.dumps(page['commentary'])} }})"))
        held = self.expected("LIMITS['chart.pie']")
        self.assertEqual(page["limits"]["exhibit"]["labels"], {"min": held["min"], "max": held["max"]})
        schema = self.printed("--schema", "numbers")
        self.assertEqual(schema["x-limits"], self.expected("pageLimits('numbers')"))
        self.assertEqual(set(schema["x-limits"]["forms"]), set(schema["properties"]["form"]["enum"]))
        self.assertNotIn("x-limits", self.printed("--schema"))

    def test_limits_prints_the_decks_and_one_forms(self):
        self.assertEqual(self.printed("--limits"), self.expected("deckLimits()"))
        self.assertEqual(self.printed("--limits", "trend/line"), self.expected("pageLimits('trend', 'line')"))
        self.assertEqual(self.printed("--limits", "trend"), self.expected("pageLimits('trend')"))
        unknown = author("--limits", "trend/pie")
        self.assertEqual(unknown.returncode, 1)
        self.assertIn('No form "pie" of trend', unknown.stderr)

    def test_limits_are_read_under_the_density_of_the_deck_named(self):
        with tempfile.TemporaryDirectory() as tmp:
            pages = Path(tmp) / "pitch.pages.json"
            pages.write_text(json.dumps({"deck": {"id": "pitch", "density": "live-pitch"}, "pages": []}), encoding="utf-8")
            self.assertEqual(self.printed(str(pages), "--limits"), self.expected("deckLimits({ density: 'live-pitch' })"))
            self.assertEqual(self.printed(str(pages), "--scaffold", "trend")["limits"]["bodyWords"],
                             self.expected("pageLimits('trend', 'line', { commentary: 'on-exhibit', density: 'live-pitch' })")["bodyWords"])

    def test_a_scaffold_pasted_whole_compiles_with_its_limits_block(self):
        page = self.printed("--scaffold", "ranking")
        result = run_node(LIMITS + f"const slide = compilePage({json.dumps(page)}); console.log(JSON.stringify({{ keys: Object.keys(slide) }}));")
        self.assertNotIn("limits", result["keys"])


if __name__ == "__main__":
    unittest.main()
