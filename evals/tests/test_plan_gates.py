"""The gates that judge the dot-dash, before a page is drawn.

Every other gate in this skill judges a rendered deck, and by then fifty pages
exist and the remedy is a rewrite. Two cold-run decks proved the cost: a
comic-book franchise comparison and a personal relocation decision, nothing in
common, came out within two points of each other on every exhibit family - 31%
charts, 42% and 44% tables, zero images, zero icons - and passed every gate the
skill had, because EVIDENCE_MIX merged charts and tables into one 45% bucket
that an all-table deck satisfies best of all.

These tests hold the shape of the replacement: separate bands per family, a
variety measure that cannot be gamed by staying just under a share cap, an
anchor rule that reaches icons as well as photographs, and - the part that
matters most - a refusal to score anything the plan does not actually record.
"""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "plan_gates.mjs"


def run_plan(plan, tmp: Path):
    tmp.write_text(json.dumps(plan), encoding="utf-8")
    out = subprocess.run([sys.executable and "node", str(GATES), str(tmp)],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode not in (0, 2):
        raise AssertionError(f"plan gates exited {out.returncode}\n{out.stderr}")
    return json.loads(out.stdout)


def page(n, **kw):
    row = {"n": n, "title": "A page that says something measurable here", "exhibit": "chart.column",
           "architecture": "exhibit-left"}
    row.update(kw)
    return row


def deck(pages):
    return {"schema": "professional-slides.plan/v1", "id": "t", "pages": pages}


class PlanGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path("/tmp/claude-plan-gate-test.plan.json")

    def codes(self, plan):
        return set(run_plan(plan, self.tmp)["countsByCode"])

    def test_a_balanced_plan_passes(self):
        shapes = ["exhibit-left", "exhibit-top", "two-up", "hero-number", "exhibit-full",
                  "picture-pair", "text", "exhibit-right"]
        # No two neighbours share an exhibit: a run of three is a finding, and
        # rightly so. The spread is wide as well as even - the craft gate counts
        # distinct exhibits per ten pages, because a deck that runs three shapes
        # evenly scores as well on entropy as one that runs twenty.
        kinds = ["chart.column", "table", "chart.bar", "cards", "chart.line", "table",
                 "steps", "chart.waterfall", "image", "chart.lollipop", "table", "timeline",
                 "chart.dumbbell", "chart.bar", "table", "chart.marimekko"]
        pages = []
        for i, kind in enumerate(kinds):
            extra = {}
            if kind == "image":
                extra = {"anchors": ["photo:london", "photo:new-york"], "points": 2}
            elif kind == "cards":
                extra = {"points": 3, "anchors": ["target", "gear", "shield"]}
            # Craft, recorded: how deep each table runs and how it is treated,
            # what is marked on each plot, and the phrase the page emphasises.
            if kind == "table":
                extra = {**extra, "rows": 8, "treatment": "heat"}
            elif kind.startswith("chart."):
                extra = {**extra, "annotation": "change bubble"}
            if i == 0:
                extra = {**extra, "highlight": "four and a half times"}
            # And why this exhibit, on the shapes a plan defaults to.
            pages.append(page(i + 1, exhibit=kind, architecture=shapes[i % len(shapes)],
                              insight="filled", why="the shape of this evidence", **extra))
        report = run_plan(deck(pages), self.tmp)
        self.assertTrue(report["accepted"], json.dumps(report["findings"], indent=1))

    def test_a_table_heavy_deck_fails_on_tables_not_on_a_merged_bucket(self):
        # The exact failure the cold runs slipped through: plenty of "measured"
        # pages, almost all of them tables.
        pages = [page(i + 1, exhibit="table" if i % 4 else "chart.column",
                      architecture="exhibit-full" if i % 3 else "exhibit-left",
                      insight="filled") for i in range(20)]
        codes = self.codes(deck(pages))
        self.assertIn("PLAN_TABLE_SHARE", codes)
        self.assertNotIn("PLAN_MEASURED_PAGES", codes, "a table-heavy deck is not short of measurement")

    def test_entropy_is_not_scored_when_the_plan_does_not_record_a_shape(self):
        # The whole point of the stage is to refuse to pass on missing data. A
        # plan with no architecture has only four or five evidence families to
        # count against the composer's twelve shapes, so the number would come
        # out high and mean nothing.
        pages = [page(i + 1, architecture=None) for i in range(20)]
        for p in pages:
            p.pop("architecture")
        report = run_plan(deck(pages), self.tmp)
        self.assertIsNone(report["statistics"]["styleEntropy"])
        finding = next(f for f in report["findings"] if f["code"] == "PLAN_STYLE_ENTROPY")
        self.assertIsNone(finding["measured"]["entropy"])
        self.assertIn("not recorded", finding["repair"])

    def test_entropy_falls_when_one_architecture_dominates(self):
        flat = [page(i + 1, architecture="exhibit-left" if i else "two-up", insight="filled")
                for i in range(20)]
        self.assertIn("PLAN_STYLE_ENTROPY", self.codes(deck(flat)))

    def test_a_declared_series_is_counted_once(self):
        # Six pages enumerating use-cases off one template is a design decision,
        # not monotony; counting them six times punishes the author for making
        # it. The run collapses to a single observation.
        shapes = ["exhibit-left", "exhibit-top", "two-up", "hero-number", "text", "exhibit-full"]
        varied = [page(i + 1, architecture=shapes[i % len(shapes)], insight="filled") for i in range(10)]
        run = [page(11 + i, architecture="exhibit-full", series="use-cases", insight="filled")
               for i in range(6)]
        with_series = run_plan(deck(varied + run), self.tmp)
        without = run_plan(deck(varied + [dict(p, series=None) for p in run]), self.tmp)
        self.assertGreater(with_series["statistics"]["styleEntropy"],
                           without["statistics"]["styleEntropy"])

    def test_a_declared_series_is_not_an_exhibit_run(self):
        pages = [page(i + 1, exhibit="table", architecture="exhibit-full", series="use-cases",
                      insight="filled") for i in range(6)]
        runs = [f for f in run_plan(deck(pages), self.tmp)["findings"] if f["code"] == "PLAN_EXHIBIT_RUN"]
        self.assertEqual(runs, [])

    def test_the_anchor_rule_reaches_icons_as_well_as_photographs(self):
        # A page naming five categories and depicting none of them is the
        # commonest page in both cold-run decks.
        bare = deck([page(1, exhibit="cards", points=5, insight="filled")])
        self.assertIn("PLAN_VISUAL_ANCHOR", self.codes(bare))
        iconed = deck([page(1, exhibit="cards", points=5, insight="filled",
                            anchors=["target", "gear", "shield", "clock", "money"])])
        self.assertNotIn("PLAN_VISUAL_ANCHOR", self.codes(iconed))
        # And the author can say no on purpose.
        declined = deck([page(1, exhibit="cards", points=5, insight="filled", anchors=False)])
        self.assertNotIn("PLAN_VISUAL_ANCHOR", self.codes(declined))

    def test_a_picture_architecture_makes_the_page_a_picture_page(self):
        # The plan's two design columns have to agree. An author who writes
        # `picture-pair` in the shape column has said the page is photographs;
        # counting it as whatever the exhibit column happens to say would put a
        # picture page in the table share, which is the number the whole stage
        # exists to move.
        plan = deck([page(1, exhibit="compare", architecture="picture-pair", insight="filled")]
                    + [page(i + 2, exhibit="chart.column", architecture="exhibit-left", insight="filled")
                       for i in range(9)])
        report = run_plan(plan, self.tmp)
        self.assertEqual(report["statistics"]["mix"]["table"], 0.0)
        self.assertGreater(report["statistics"]["mix"]["picture"], 0)

    def test_a_chart_needs_no_anchor(self):
        # The marks are the anchor; icons on a chart's categories are decoration.
        plan = deck([page(1, exhibit="chart.bar", points=5, insight="filled")])
        self.assertNotIn("PLAN_VISUAL_ANCHOR", self.codes(plan))

    def test_a_deck_with_no_pictures_icons_or_insights_says_so_separately(self):
        pages = [page(i + 1, exhibit="chart.column" if i % 2 else "table",
                      architecture="exhibit-left" if i % 3 else "two-up") for i in range(12)]
        codes = self.codes(deck(pages))
        self.assertIn("PLAN_NO_PICTURES", codes)
        self.assertIn("PLAN_NO_ICONS", codes)
        self.assertIn("PLAN_NO_INSIGHT", codes)

    def test_an_anchor_is_a_photograph_however_the_plan_spells_it(self):
        """Found on a hand-written 50-page plan that put artwork on every page.

        `isPhoto` read the *value* against /^photo/, so `{photo: "Superman"}` -
        the obvious encoding, where the key is the claim - counted as no
        photograph, and the plan was told it carried none. A deck-wide device
        gate that reports zero when the author wrote fifty is worse than no
        gate: it is the kind of finding an author reads as settled.
        """
        for anchor in ["photo: Superman", "image: skyline.jpg",
                       {"photo": "Superman"}, {"image": "skyline.jpg"},
                       {"kind": "photo", "photo": "Superman"},
                       {"kind": "image", "image": "skyline.jpg"}]:
            with self.subTest(anchor=anchor):
                pages = [page(i + 1, exhibit="chart.bar", insight="filled",
                              architecture="exhibit-left" if i % 2 else "two-up",
                              anchors=[anchor]) for i in range(12)]
                codes = self.codes(deck(pages))
                self.assertNotIn("PLAN_NO_PICTURES", codes)
                self.assertIn("PLAN_NO_ICONS", codes, "and a photograph is not an icon")
        for anchor in ["target", {"icon": "target"}, {"kind": "icon", "icon": "target"}]:
            with self.subTest(anchor=anchor):
                pages = [page(i + 1, exhibit="chart.bar", insight="filled",
                              architecture="exhibit-left" if i % 2 else "two-up",
                              anchors=[anchor]) for i in range(12)]
                codes = self.codes(deck(pages))
                self.assertNotIn("PLAN_NO_ICONS", codes)
                self.assertIn("PLAN_NO_PICTURES", codes, "and an icon is not a photograph")

    def test_titles_written_to_the_ceiling_are_reported(self):
        long = " ".join(f"word{i}" for i in range(14))
        pages = [page(i + 1, title=long, architecture="exhibit-left" if i % 2 else "two-up",
                      insight="filled") for i in range(12)]
        finding = next(f for f in run_plan(deck(pages), self.tmp)["findings"]
                       if f["code"] == "PLAN_TITLE_LENGTH")
        self.assertEqual(finding["measured"]["max"], 14)
        self.assertIn("ceiling, not a target", finding["repair"])

    def test_the_craft_gates_see_what_the_mix_gates_cannot(self):
        """A deck can pass every mix, entropy and anchor gate and still be dry.

        The 50-page Marvel plan did exactly that - 44% charts, 22% tables, 0.888
        entropy, nine architectures, pictures and icons and insights all present
        - and rendered as ten three-row tables with no treatment among them,
        eighteen charts with nothing marked on any plot, and not one highlighted
        phrase. None of it was a failure of judgement: none of it was recorded,
        so none of it was ever chosen.
        """
        # Wide enough to clear the variety floor, so only the craft codes fire.
        kinds = ["chart.column", "table", "chart.bar", "cards", "chart.line", "table",
                 "steps", "chart.waterfall", "chart.lollipop", "timeline",
                 "chart.dumbbell", "table", "chart.marimekko", "chart.slope"]
        bare = [page(i + 1, exhibit=k, architecture=["exhibit-left", "exhibit-top", "two-up",
                     "hero-number", "exhibit-full", "text"][i % 6], insight="filled",
                     anchors=["photo:a"] if i == 3 else ["target"])
                for i, k in enumerate(kinds)]
        codes = self.codes(deck(bare))
        self.assertIn("PLAN_TABLE_DEPTH", codes, "an unrecorded table size is not a passing table size")
        self.assertIn("PLAN_TABLE_MONOTONY", codes)
        self.assertIn("PLAN_UNANNOTATED_CHARTS", codes)
        self.assertIn("PLAN_NO_HIGHLIGHT", codes)
        self.assertNotIn("PLAN_EXHIBIT_VARIETY", codes)

        # A shallow table is a finding even when its depth *is* recorded.
        shallow = [dict(p, rows=3, treatment="heat") if p["exhibit"] == "table" else p for p in bare]
        self.assertIn("PLAN_TABLE_DEPTH", self.codes(deck(shallow)))
        self.assertNotIn("PLAN_TABLE_MONOTONY", self.codes(deck(shallow)))

        # Recorded and deep enough, treated, annotated, one phrase emphasised.
        good = [dict(p) for p in bare]
        for row in good:
            if row["exhibit"] == "table":
                row.update(rows=9, treatment="verdict column")
            elif row["exhibit"].startswith("chart."):
                row.update(annotation="reference line at the target")
        good[0]["highlight"] = "four and a half times"
        for row in good:
            row["why"] = "the shape of this evidence"
        self.assertEqual(self.codes(deck(good)), set())

    def test_variety_counts_the_repertoire_not_just_the_spread(self):
        # Entropy normalises by how many exhibits were used, so three shapes
        # used evenly score as well as twenty. The Marvel plan measured 0.908
        # against the example decks' 0.93-0.97 while drawing on a third as many
        # exhibits per page, which is the gap this counts.
        pages = [page(i + 1, exhibit=["chart.bar", "chart.column", "table"][i % 3],
                      architecture=["exhibit-left", "exhibit-top", "two-up", "text"][i % 4],
                      insight="filled", rows=9, treatment="heat", annotation="bracket",
                      highlight="x" if i == 0 else None)
                 for i in range(21)]
        report = run_plan(deck(pages), self.tmp)
        self.assertGreater(report["statistics"]["styleEntropy"], 0.9, "evenly spread across four shapes")
        self.assertLess(report["statistics"]["exhibitVarietyPerTen"], 2, "and drawing on three exhibits")
        self.assertIn("PLAN_EXHIBIT_VARIETY", {f["code"] for f in report["findings"]})

    def test_a_default_exhibit_has_to_say_why_it_was_chosen(self):
        # 25 of the generated deck's 45 pages took one of four shapes. Each is
        # often the right answer; choosing one is simply where a default hides,
        # so it is the one place worth making the plan produce a sentence.
        rows = [page(i + 1, exhibit=["table", "chart.column", "chart.bar", "steps"][i % 4],
                     architecture=["exhibit-left", "exhibit-top", "two-up", "text"][i % 4],
                     insight="filled", rows=9, treatment="heat", annotation="bracket",
                     highlight="x" if i == 0 else None) for i in range(12)]
        self.assertIn("PLAN_EXHIBIT_REASON", self.codes(deck(rows)))
        explained = [dict(r, why="magnitude over time") for r in rows]
        self.assertNotIn("PLAN_EXHIBIT_REASON", self.codes(deck(explained)))
        # A phrase, not a shrug.
        self.assertIn("PLAN_EXHIBIT_REASON", self.codes(deck([dict(r, why="yes") for r in rows])))
        # An exhibit nobody defaults to needs no defence.
        chosen = [dict(r, exhibit="chart.marimekko") for r in rows]
        self.assertNotIn("PLAN_EXHIBIT_REASON", self.codes(deck(chosen)))

    def test_the_variant_counts_toward_variety_where_it_is_recorded(self):
        # Recording variants can only raise the measured variety, never lower
        # it, so a plan written before this existed is judged as it was.
        rows = [page(i + 1, exhibit="table", architecture=["exhibit-left", "two-up", "text"][i % 3],
                     insight="filled", rows=9, treatment="heat", annotation="b",
                     why="genuinely a matrix", highlight="x" if i == 0 else None) for i in range(12)]
        flat = run_plan(deck(rows), self.tmp)["statistics"]["exhibitVarietyPerTen"]
        varied = run_plan(deck([dict(r, variant=["heat", "bubble", "harvey", "verdict"][i % 4])
                                for i, r in enumerate(rows)]), self.tmp)["statistics"]["exhibitVarietyPerTen"]
        self.assertGreater(varied, flat)

    def test_every_finding_names_a_code_and_carries_a_repair(self):
        pages = [page(i + 1, exhibit="table", architecture="exhibit-full") for i in range(20)]
        report = run_plan(deck(pages), self.tmp)
        self.assertTrue(report["findings"])
        for item in report["findings"]:
            self.assertEqual(sorted(item), ["code", "measured", "page", "repair", "threshold"])
            self.assertGreaterEqual(len(item["repair"]), 60, item["code"])

    def test_the_report_carries_the_deck_statistics_beside_the_reference(self):
        pages = [page(i + 1, architecture="exhibit-left", insight="filled") for i in range(12)]
        report = run_plan(deck(pages), self.tmp)
        self.assertIn("mix", report["statistics"])
        self.assertIn("styleEntropy", report["reference"])
        self.assertIn("observed", report["reference"])


if __name__ == "__main__":
    unittest.main()
