"""What the deck draws, what shape its words are in, and which way it navigates.

Three defects a fifty-one page deck shipped with, each of which passed every
gate that existed at the time:

  - it drew three of ten device families: no icon, no rating, no value pill, no
    photograph, no growth annotation, no status pill
  - its commentary was one block of 150 to 200 words per page, against a client
    median of four blocks of about 56
  - it set the same tracker pill on all fifty-one pages, 588 nodes of it

None is visible on a single page, which is why per-page gates missed all three.
"""

from __future__ import annotations

import json
import sys
import unittest

from node_probe import ROOT, RUNTIME, run_node

GATES = RUNTIME / "gates"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


def text(role, value, **over):
    return dict({"type": "text", "role": role, "text": value}, **over)


def page(n, *, roles=()):
    nodes = [text("action-title", f"Page {n} states a finding worth reading"),
             text("list-item", "The second wave opens on a gate rather than on a date"),
             text("source-text", "Source: engagement analysis, 2026")]
    nodes += [{"type": "rect", "role": role} for role in roles]
    nodes += [{"type": "rect", "role": "chart-mark"} for _ in range(12)]
    return {"id": f"s{n:02d}",
            "componentInstances": [{"id": f"s{n:02d}-0", "component": "chart.column"}],
            "nodes": nodes}


def vocabulary(slides):
    findings = []
    page_gates.gate_deck_vocabulary(slides, list(range(len(slides))), findings)
    return findings


class DeckVocabularyTests(unittest.TestCase):
    def test_a_deck_that_draws_three_families_is_reported(self):
        slides = [page(i, roles=["table-bar", "chart-reference-line", "annotation-surface"])
                  for i in range(1, 15)]
        findings = vocabulary(slides)
        self.assertEqual([f["code"] for f in findings], ["DECK_VOCABULARY"])
        measured = findings[0]["measured"]
        self.assertEqual(measured["families"], 3)
        for absent in ("icon", "picture", "score", "valuePill", "state"):
            self.assertIn(absent, measured["absent"])
        self.assertIn("not chosen between them", findings[0]["repair"])

    def test_a_deck_that_reaches_for_four_passes(self):
        slides = [page(i, roles=["card-icon-glyph", "table-rating-sector", "chart-reference-line", "table-status-pill"])
                  for i in range(1, 15)]
        self.assertEqual(vocabulary(slides), [])

    def test_a_short_deck_is_not_measured_on_its_vocabulary(self):
        # Eleven pages is below the floor: a short deck has fewer jobs to do.
        slides = [page(i) for i in range(1, 12)]
        self.assertEqual(vocabulary(slides), [])

    def test_the_patterns_match_the_roles_the_runtime_actually_emits(self):
        """The first version looked for an exact `card-icon` and would have
        scored every deck at zero: the marker helpers suffix the role they are
        given. These are the roles a scene composed from the gallery deck
        carries."""
        emitted = ["card-icon-glyph", "list-icon-glyph", "table-cell-icon-glyph", "image",
                   "table-rating-sector", "table-bubble", "table-bar", "table-status-pill",
                   "metric-delta", "chart-reference-line", "chart-annotation"]
        for role in emitted:
            with self.subTest(role=role):
                self.assertTrue(any(p.match(role) for p in page_gates.DEVICE_FAMILIES.values()),
                                f"{role} matches no device family")

    def test_the_floor_is_recorded_as_a_vocabulary_floor_not_a_corpus_rate(self):
        rule = page_gates.CONTRACT["plan"]["craft"]["vocabulary"]
        self.assertIn("cannot be read off a render", rule["$comment"])
        self.assertLessEqual(rule["familiesMin"], len(page_gates.DEVICE_FAMILIES) // 2)


class TextFormTests(unittest.TestCase):
    """A run of prose longer than client decks ever set is caught in the dot-dash."""

    def plan(self, words):
        body = " ".join(f"word{i}" for i in range(words))
        return {
            "schema": "professional-slides.content/v1", "id": "t", "textContract": "complete",
            "question": "Q?", "answer": "A.",
            "pages": [{
                "id": "p1", "n": 1, "claim": "A page that proves something", "settles": {"kind": "count", "what": "x"},
                "adds": None, "highlight": None,
                "textPlan": [{"id": "t", "role": "title", "text": "A page that proves something"},
                             {"id": "b", "role": "body", "text": body}],
                "textReference": {"task": "chart-with-commentary"},
            }],
        }

    def check(self, words):
        return run_node(f'''
import {{checkTextPlan}} from './skills/professional-slides/runtime/text-contract.mjs';
const content = {json.dumps(self.plan(words))};
const result = checkTextPlan(content);
console.log(JSON.stringify({{codes: result.findings.map(f=>f.code), scores: result.scores}}));
''')

    def test_a_block_past_the_client_third_quartile_is_refused(self):
        result = self.check(200)
        self.assertIn("TEXT_BLOCK_TOO_LONG", result["codes"])

    def test_a_block_inside_it_passes(self):
        result = self.check(150)
        self.assertNotIn("TEXT_BLOCK_TOO_LONG", result["codes"])

    def test_the_score_records_the_shape_as_well_as_the_volume(self):
        score = self.check(150)["scores"][0]
        self.assertEqual(score["proseBlocks"], 1)
        self.assertEqual(score["longestBlock"], 150)

    def test_the_cap_comes_from_the_measured_corpus(self):
        contract = json.loads((RUNTIME / "weight.json").read_text(encoding="utf-8"))
        form = contract["plan"]["textForm"]
        self.assertEqual(form["longestBlockMax"], form["longestBlock"]["q3"])
        self.assertGreaterEqual(form["pagesMeasured"], 30)


class TrackerChoiceTests(unittest.TestCase):
    """The navigation construction is read off the section map, not fixed."""

    def construction(self, titles):
        sections = ",".join(
            f'''{{id:'d{i}',kind:'section',title:{json.dumps(t)}}},
                {{id:'p{i}',title:'A page that proves something about it',layout:'text',
                  points:[{{text:'A developed point that carries this page on its own.'}}]}}'''
            for i, t in enumerate(titles))
        return run_node(f'''
import {{toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
const plan = toDeckPlan({{schema:'professional-slides.deck/v3', id:'t', slides:[
  {{id:'sum',title:'The answer is stated first',role:'executive-summary',layout:'text',
    points:[{{text:'A finding that carries the page and says something.'}}]}},
  {sections}]}});
const page = plan.slides.find(s=>s.tracker);
console.log(JSON.stringify({{construction: page ? page.tracker.construction : null}}));
''')["construction"]

    def test_a_few_short_sections_take_pills(self):
        self.assertEqual(self.construction(["Scale", "Floor", "Story"]), "compact-pills")

    def test_many_sections_take_the_label(self):
        self.assertEqual(
            self.construction(["Claim", "Scale", "Floor", "Story", "Beyond film", "Against", "Verdict"]),
            "compact-label")

    def test_long_section_names_take_the_label(self):
        self.assertEqual(self.construction(["Where the value is", "How we would capture it"]), "compact-label")


class TableDensityTests(unittest.TestCase):
    """The type floor has to admit the smallest table the composer can set.

    The density ladder ends at `dense`, which sets cells at type.label. With the
    floor at 9.0 pt and type.label at 8.5, any table that reached the last rung
    was refused with no rung left to fall to, and the only repair was to delete
    rows the page needed.
    """

    def test_the_floor_admits_the_densest_table_on_every_palette(self):
        """Compose one per palette, rather than restate the size here.

        type.label is 9 pt on the default theme and 8.5 on others, so a floor at
        9.0 passed every test written against the default and refused real decks
        built on the rest. A table that reaches the last rung has nowhere else to
        fall, so the only repair left was deleting rows the page needed.
        """
        rows = [[f"Row {i}", str(i), f"{i * 3}%"] for i in range(1, 12)]
        floor = page_gates.TYPE_RANGES["table-dense"][0]
        for palette in ("mckinsey", "bcg", "bain", "deloitte", "consulting-toolkit"):
            with self.subTest(palette=palette):
                self.assertLessEqual(floor, self.densest(rows, palette),
                                     "a table at the last rung of the ladder is refused")

    def densest(self, rows, palette):
        sizes = run_node(f'''
import {{toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
import {{planDeck}} from './skills/professional-slides/runtime/planner.mjs';
const deck = planDeck(toDeckPlan({{schema:'professional-slides.deck/v3', id:'t',
  palette:{json.dumps(palette)}, density:'pre-read', slides:[{{
  id:'p', title:'A table set at the densest rung the ladder has', layout:'exhibit-top',
  exhibit:{{type:'table', density:'dense', columns:['Name','Count','Share'],
            rows:{json.dumps(rows)}}},
  points:[{{text:'A developed point that carries this page on its own.'}}]}}]}})).deck;
const pts = deck.slides[0].nodes
  .filter(n => n.role === 'table-cell-text')
  .map(n => n.style?.fontSize?.value ?? n.style?.fontSize);
console.log(JSON.stringify({{min: Math.min(...pts), count: pts.length}}));
''')
        self.assertGreater(sizes["count"], 0)
        return sizes["min"]

    def test_the_floor_still_refuses_type_smaller_than_any_rung(self):
        self.assertGreater(page_gates.TYPE_RANGES["table-dense"][0], 7.0)


class HighlightedVerdictTests(unittest.TestCase):
    """A page may name its own verdict word as its highlight phrase.

    `build-deck` transfers the content plan's highlight onto the slide, and the
    highlight pass rewrites any cell containing the phrase from a string into
    `{text, highlight}`. Verdict typing ran afterwards and returned early on
    anything that was not a string, so a scorecard highlighting "Wins" got grey
    text on its two winning rows and coloured pills on the four it lost - the
    opposite emphasis to the one the page asked for.
    """

    ROWS = [["Recovery", "Largest rise after a rejected film", "Wins"],
            ["Reach", "Share of gross outside North America", "Ties"],
            ["Quality floor", "Lowest critic score in the run", "Loses"]]

    def verdict_column(self, highlight):
        """The last cell of every row, as the composer leaves it."""
        return run_node(f'''
import {{toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
const plan = toDeckPlan({{schema:'professional-slides.deck/v3', id:'t', slides:[{{
  id:'p', title:'A scorecard whose last column states the verdict',
  layout:'exhibit-top', highlight:{json.dumps(highlight)},
  exhibit:{{type:'table', columns:[
    {{label:'Test', width:1.4}}, {{label:'Measure', width:2.2}}, {{label:'Verdict', width:1.0}}],
    rows:{json.dumps(self.ROWS)}}},
  points:[{{text:'A developed point that carries this page on its own and says something.'}}]}}]}});
const table = JSON.parse(JSON.stringify(plan)).slides[0];
const rows = JSON.stringify(table).match(/"rows":(\[\[.*?\]\])/)[1];
console.log(JSON.stringify(JSON.parse(rows).map(r => r[r.length - 1])));
''')

    def states(self, highlight):
        return [c.get("value") if isinstance(c, dict) else None
                for c in self.verdict_column(highlight)]

    def test_every_verdict_is_typed_when_none_is_highlighted(self):
        self.assertEqual(self.states(None), ["won", "drawn", "lost"])

    def test_the_highlighted_verdict_is_typed_like_the_rest(self):
        self.assertEqual(self.states("Wins"), ["won", "drawn", "lost"])

    def test_the_pill_replaces_the_accent_rather_than_carrying_both(self):
        first = self.verdict_column("Wins")[0]
        self.assertEqual(first["type"], "rag")
        self.assertNotIn("highlight", first)

    def test_a_highlight_on_an_ordinary_cell_still_marks_it(self):
        marked = run_node(f'''
import {{toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
const plan = toDeckPlan({{schema:'professional-slides.deck/v3', id:'t', slides:[{{
  id:'p', title:'A scorecard whose last column states the verdict',
  layout:'exhibit-top', highlight:'Lowest critic score',
  exhibit:{{type:'table', columns:[
    {{label:'Test', width:1.4}}, {{label:'Measure', width:2.2}}, {{label:'Verdict', width:1.0}}],
    rows:{json.dumps(self.ROWS)}}},
  points:[{{text:'A developed point that carries this page on its own and says something.'}}]}}]}});
const rows = JSON.stringify(plan).match(/"rows":(\[\[.*?\]\])/)[1];
console.log(JSON.stringify(JSON.parse(rows)[2]));
''')
        self.assertEqual(marked[1]["highlight"], ["Lowest critic score"])
        self.assertEqual(marked[2]["value"], "lost")


class TakeawayLengthTests(unittest.TestCase):
    """A takeaway band says the reading once."""

    def band(self, lines):
        return {"id": "s01", "nodes": [
            text("action-title", "A title that states the finding"),
            {"type": "text", "role": "insight-body", "text": "\n".join(f"line {i}" for i in range(lines)),
             "data": {"textLayout": {"lines": [f"line {i}" for i in range(lines)]}}}]}

    def codes(self, lines):
        findings = []
        page_gates.gate_takeaway_long(1, self.band(lines), findings)
        return [f["code"] for f in findings]

    def test_two_lines_pass(self):
        self.assertEqual(self.codes(2), [])

    def test_three_lines_are_tolerated(self):
        self.assertEqual(self.codes(3), [])

    def test_four_lines_are_a_paragraph(self):
        self.assertEqual(self.codes(4), ["TAKEAWAY_LONG"])

    def test_it_blocks(self):
        self.assertNotIn("TAKEAWAY_LONG", page_gates.ADVISORY_CODES)


class ReadingTaskTests(unittest.TestCase):
    """The declared reading task has to describe the page that was composed."""

    def mismatch(self, task, roles):
        nodes = [{"type": "text", "role": r, "text": "x"} for r in roles]
        return run_node(f'''
import {{readingTaskMismatch}} from './skills/professional-slides/runtime/text-contract.mjs';
console.log(JSON.stringify(readingTaskMismatch({json.dumps(task)}, {{nodes: {json.dumps(nodes)}}})));
''')

    FULL_WIDTH = ["action-title", "axis-label", "insight-body", "footnote-text"]
    WITH_COLUMN = ["action-title", "axis-label", "list-lead", "list-item"]

    def test_a_full_width_page_measured_as_commentary_is_refused(self):
        result = self.mismatch("exhibit-with-commentary", self.FULL_WIDTH)
        self.assertIsNotNone(result)
        self.assertIn("padding its takeaway band", result["reason"])

    def test_a_commentary_page_claiming_the_lighter_floor_is_refused(self):
        result = self.mismatch("exhibit-led", self.WITH_COLUMN)
        self.assertIsNotNone(result)
        self.assertIn("understate", result["reason"])

    def test_matching_tasks_pass(self):
        self.assertIsNone(self.mismatch("exhibit-led", self.FULL_WIDTH))
        self.assertIsNone(self.mismatch("exhibit-with-commentary", self.WITH_COLUMN))

    def test_a_task_outside_the_vocabulary_is_not_second_guessed(self):
        self.assertIsNone(self.mismatch("comparison-table", self.FULL_WIDTH))


class ChartMonotonyTests(unittest.TestCase):
    """One chart type doing most of a deck's charting is reported."""

    def gate(self, charts, extra=()):
        pages = [{"id": f"p{i}", "n": i + 1, "exhibit": t, "architecture": "evidence-only", "why": "because"}
                 for i, t in enumerate(list(charts) + list(extra))]
        return run_node(f'''
import {{runPlanGates}} from './skills/professional-slides/runtime/gates/plan_gates.mjs';
const r = runPlanGates({{schema:'professional-slides.plan/v1', pages:{json.dumps(pages)}}});
console.log(JSON.stringify(r.findings.filter(f => f.code === 'PLAN_CHART_MONOTONY')));
''')

    def test_seven_columns_in_seventeen_charts_is_reported(self):
        charts = ["chart.column"] * 7 + ["chart.bar"] * 3 + ["chart.line"] * 3 + ["chart.scatter", "chart.pie", "chart.waterfall", "chart.combo"]
        found = self.gate(charts)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["measured"]["chart"], "chart.column")
        self.assertIn("selector table", found[0]["repair"])

    def test_a_spread_of_charts_passes(self):
        charts = ["chart.column", "chart.bar", "chart.line", "chart.scatter", "chart.waterfall", "chart.combo",
                  "chart.dumbbell", "chart.waffle", "chart.column", "chart.bar"]
        self.assertEqual(self.gate(charts), [])

    def test_a_deck_with_few_charts_is_not_judged_on_their_mix(self):
        self.assertEqual(self.gate(["chart.column"] * 5), [])

    def test_it_is_advisory(self):
        charts = ["chart.column"] * 8
        report = run_node(f'''
import {{runPlanGates}} from './skills/professional-slides/runtime/gates/plan_gates.mjs';
const pages = {json.dumps([{"id": f"p{i}", "n": i + 1, "exhibit": t, "architecture": "evidence-only", "why": "b"} for i, t in enumerate(charts)])};
const r = runPlanGates({{schema:'professional-slides.plan/v1', pages}});
console.log(JSON.stringify(r.findings.filter(f => f.code === 'PLAN_CHART_MONOTONY').map(f => f.severity)));
''')
        self.assertEqual(report, ["advisory"])


class ReadingTaskBankTests(unittest.TestCase):
    """The development bank is every judged client page, measured and hashed;
    the runtime ships only each task's quartiles, distilled from it."""

    BANK = json.loads((ROOT / "evals" / "corpus" / "reading-task-bank.json").read_text(encoding="utf-8"))
    SHIPPED = json.loads((RUNTIME / "reading-tasks.json").read_text(encoding="utf-8"))["tasks"]

    def test_every_sample_is_a_measured_hashed_page(self):
        for task, samples in self.BANK["tasks"].items():
            for s in samples:
                with self.subTest(task=task, reference=s["reference"], page=s["page"]):
                    self.assertRegex(s["sha256"], r"^[0-9a-f]{64}$")
                    self.assertGreater(s["bodyWords"], 0, "a raster page is never a zero-word baseline")
                    self.assertGreaterEqual(s["totalWords"], s["bodyWords"])

    def test_the_shipped_targets_are_the_banks_quartiles(self):
        import statistics
        for task, samples in self.BANK["tasks"].items():
            with self.subTest(task=task):
                words = [s["bodyWords"] for s in samples]
                self.assertEqual(self.SHIPPED[task]["pages"], len(samples))
                self.assertAlmostEqual(self.SHIPPED[task]["bodyWords"]["median"], statistics.median(words), delta=0.1)

    def test_a_chart_page_without_commentary_is_measured_against_its_own_kind(self):
        self.assertLess(self.SHIPPED["chart-led"]["bodyWords"]["median"], self.SHIPPED["chart-with-commentary"]["bodyWords"]["median"])

    def test_the_cross_check_knows_every_task_that_has_a_column_or_not(self):
        known = run_node("""
import {READING_TASKS} from './skills/professional-slides/runtime/text-contract.mjs';
console.log(JSON.stringify(Object.keys(READING_TASKS)));
""")
        for task in self.BANK["commentary"]:
            self.assertIn(task, known)


class FigureRoleVocabularyTests(unittest.TestCase):
    """The device families count the roles the figure components emit."""

    def test_a_figure_icon_counts_as_an_icon(self):
        for role in ("capsule-icon-glyph", "placement-icon-glyph", "arrow-row-icon-ring", "pictogram-figure-glyph"):
            with self.subTest(role=role):
                self.assertTrue(page_gates.DEVICE_FAMILIES["icon"].match(role))

    def test_a_supplied_table_photo_counts_and_its_empty_slot_does_not(self):
        self.assertTrue(page_gates.DEVICE_FAMILIES["picture"].match("table-photo"))
        self.assertFalse(page_gates.DEVICE_FAMILIES["picture"].match("table-photo-placeholder"))
