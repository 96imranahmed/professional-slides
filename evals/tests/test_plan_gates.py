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
        # rightly so.
        kinds = ["chart.column", "table", "chart.bar", "cards", "chart.line", "table",
                 "steps", "chart.column", "image", "chart.bar", "table", "cards",
                 "chart.column", "chart.bar", "table", "chart.line"]
        pages = []
        for i, kind in enumerate(kinds):
            extra = {}
            if kind == "image":
                extra = {"anchors": ["photo:london", "photo:new-york"], "points": 2}
            elif kind == "cards":
                extra = {"points": 3, "anchors": ["target", "gear", "shield"]}
            pages.append(page(i + 1, exhibit=kind, architecture=shapes[i % len(shapes)],
                              insight="filled", **extra))
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

    def test_titles_written_to_the_ceiling_are_reported(self):
        long = " ".join(f"word{i}" for i in range(14))
        pages = [page(i + 1, title=long, architecture="exhibit-left" if i % 2 else "two-up",
                      insight="filled") for i in range(12)]
        finding = next(f for f in run_plan(deck(pages), self.tmp)["findings"]
                       if f["code"] == "PLAN_TITLE_LENGTH")
        self.assertEqual(finding["measured"]["max"], 14)
        self.assertIn("ceiling, not a target", finding["repair"])

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
