"""What the page says, rather than how it is drawn.

Every other gate in `page_gates.py` measures geometry or typography. A 50-page
Marvel vs. DC deck cleared all of them and was rated 2-3/10 by the person who
opened it, because:

* twenty-eight of its fifty pages opened a sentence with the literal word
  "Interpretation:";
* fifty-nine lines across thirty-six pages said what the evidence does not
  establish, one page saying it five times;
* fourteen tables opened with the column header `Dimension` and four more with
  `Element | Story mechanism` - two schemas over eighteen pages;
* an "Avengers | Justice League" table carried word-for-word identical text in
  all four rows, on a page whose title promised a comparison;
* its commentary reused a median 38% of its own content words from the exhibit
  beside it, against 25-36% in the reference decks.

None of that is visible to a threshold on ink, span or type. These five gates
are, and each test below is one of the measurements above.

The falsifiability half matters as much: the four example decks must stay clean,
because a content gate that fires on good work is one that gets switched off. It
took two rounds to get there - the first version called a funnel table's shared
owner a failed comparison, and called "Education does not decide the city; it
decides the neighborhood" a hedge.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402
from node_probe import example_scene  # noqa: E402


def text(role, body, **data):
    return {"type": "text", "role": role, "text": body,
            "data": {"textLayout": {"lines": body.split("\n")}, **data}}


def table(rows, headers=None):
    """A table as the renderer leaves it: one node per cell, row/column recorded."""
    nodes = []
    for c, label in enumerate(headers or []):
        nodes.append(text("table-header-text", label, row=-1, column=c))
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            nodes.append(text("table-cell-text", cell, row=r, column=c))
    return nodes


def page(nodes, ident="s01"):
    return {"id": ident, "nodes": nodes, "componentInstances": [{"id": ident, "component": "table"}]}


def run(gate, *args):
    findings = []
    gate(*args, findings)
    return findings


class TwinCellTests(unittest.TestCase):
    """A comparison table whose compared columns say the same thing."""

    def test_a_table_that_compares_nothing_is_reported(self):
        # Page 10 of the deck, reproduced: "Avengers and Justice League connect
        # heroes with independent identities", four rows, both columns identical.
        rows = [
            ["Independent identities", "Recognizable heroes bring established identities into the team",
             "Recognizable heroes bring established identities into the team"],
            ["Collective response", "An ensemble makes combinations and relationships possible",
             "An ensemble makes combinations and relationships possible"],
            ["Distinctive value", "The team must offer more than parallel solo appearances",
             "The team must offer more than parallel solo appearances"],
            ["Boundary", "A team concept does not prove one fixed roster",
             "A team concept does not prove one fixed roster"],
        ]
        findings = run(page_gates.gate_twin_cells, 10, page(table(rows, ["Dimension", "Avengers", "Justice League"])))
        self.assertEqual([f["code"] for f in findings], ["TWIN_CELLS"])
        self.assertEqual(findings[0]["measured"]["rows"], 4)
        self.assertIn("compares nothing", findings[0]["repair"])

    def test_one_shared_cell_is_a_fact_about_the_data(self):
        """The first version of this gate fired on a reference deck.

        A funnel table's `Owner` row gives customer success two consecutive
        stages, which is true and is how funnels work. A comparison stops
        comparing when it happens twice and across a good share of the table,
        not the first time two cells agree.
        """
        rows = [
            ["Owner", "Marketing", "Marketing", "Sales", "Customer success", "Customer success"],
            ["Deliverables", "Content library", "Comparison guides", "Signed order form",
             "Set-up checklist", "Renewal offer"],
            ["Metric", "Qualified visits", "Trial starts", "Win rate", "Time to first value", "Net retention"],
        ]
        self.assertEqual(run(page_gates.gate_twin_cells, 17, page(table(rows))), [])

    def test_two_columns_are_not_a_comparison(self):
        # A label column and one measure: nothing to twin.
        rows = [["Revenue", "1,240"], ["Cost", "1,240"]]
        self.assertEqual(run(page_gates.gate_twin_cells, 3, page(table(rows))), [])


class RestatementTests(unittest.TestCase):
    """The commentary reads the exhibit back to the reader."""

    EXHIBIT = table([
        ["Prior sequence", "Marvel describes Endgame as the conclusion to a 22-film sequence"],
        ["Inherited consequence", "Thanos's earlier action supplies the problem confronting the remaining Avengers"],
        ["Collective response", "The surviving ensemble responds to consequences already established"],
    ], ["Element", "Story mechanism"])

    def test_commentary_built_from_the_exhibits_words_is_reported(self):
        said = [text("list-item", "Marvel describes Endgame as the conclusion to a 22-film sequence."),
                text("list-item", "Thanos's earlier action supplies the problem confronting the remaining Avengers."),
                text("list-item", "The surviving ensemble responds to consequences already established.")]
        findings = run(page_gates.gate_restatement, 35, page(self.EXHIBIT + said))
        self.assertEqual([f["code"] for f in findings], ["RESTATEMENT"])
        self.assertGreater(findings[0]["measured"]["share"], page_gates.THRESHOLDS["restatement_max"])
        # The page is reported on the block a reader would read, not on a pooled
        # average over the column.
        self.assertIn("Marvel describes", findings[0]["measured"]["block"])

    def test_one_restating_block_is_not_diluted_by_the_ones_around_it(self):
        """Three sentences that bring their own words and one that reads the
        table back pooled out to 0.33 and passed. A reader does not average a
        column; they read the block, and the block says nothing."""
        said = [text("list-item", "Twenty-two films of prior investment is the price of admission, "
                                  "and it is charged to every newcomer who arrives at the finale first."),
                text("list-item", "Budget the onboarding: a viewer who starts here needs ninety minutes "
                                  "of catch-up before the opening scene lands."),
                text("list-item", "Thanos's earlier action supplies the problem confronting the remaining Avengers.")]
        findings = run(page_gates.gate_restatement, 35, page(self.EXHIBIT + said))
        self.assertEqual([f["code"] for f in findings], ["RESTATEMENT"])
        self.assertIn("Thanos", findings[0]["measured"]["block"])

    def test_commentary_that_brings_its_own_words_passes(self):
        said = [text("list-item", "Twenty-two films of prior investment is the price of admission, "
                                  "and it is charged to every newcomer who arrives at the finale first."),
                text("list-item", "Budget the onboarding: a viewer who starts here needs ninety minutes "
                                  "of catch-up before the opening scene lands."),
                text("list-item", "Franchises without that backlog buy their payoff differently, "
                                  "usually by spending a whole act on introductions.")]
        self.assertEqual(run(page_gates.gate_restatement, 35, page(self.EXHIBIT + said)), [])

    def test_a_page_with_no_exhibit_or_no_commentary_is_not_measured(self):
        only_commentary = page([text("list-item", "A finding that stands on its own entirely.")])
        self.assertEqual(run(page_gates.gate_restatement, 1, only_commentary), [])
        self.assertEqual(run(page_gates.gate_restatement, 1, page(self.EXHIBIT)), [])


class PlanningVoiceTests(unittest.TestCase):
    """The dot-dash, left on the page."""

    def test_a_planning_label_on_a_sentence_is_reported(self):
        for line in ["Interpretation: the team can generate drama before a villain arrives.",
                     "Takeaway: both libraries support billion-dollar films.",
                     "So what: the order of introduction is not a quality verdict.",
                     "Key insight - responsibility connects the two brands."]:
            with self.subTest(line=line):
                findings = run(page_gates.gate_planning_voice, 8, page([text("list-item", line)]))
                self.assertEqual([f["code"] for f in findings], ["PLANNING_VOICE"])
                self.assertIn("Delete the label and keep the sentence", findings[0]["repair"])

    def test_the_same_words_inside_a_sentence_are_left_alone(self):
        for line in ["The interpretation a reader brings decides which version they prefer.",
                     "Its takeaway is cheaper to state than to prove.",
                     "Note the eleven-month clock: it is the only one that cannot be recovered."]:
            with self.subTest(line=line):
                self.assertEqual(run(page_gates.gate_planning_voice, 8, page([text("list-item", line)])), [])


class CaveatTests(unittest.TestCase):
    """A page that spends itself on what it does not establish."""

    def test_a_page_that_qualifies_itself_three_times_is_reported(self):
        # Page 33, which states its 30-year interval three times and then says
        # twice more what the interval does not establish.
        said = [text("list-item", "The selected milestones are 30 years apart, calculated as 2008 minus 1978."),
                text("list-item", "This is a comparison of those landmarks, not a claim that Marvel had no "
                                  "earlier screen adaptations."),
                text("list-item", "Dates establish an order. They do not establish artistic quality."),
                text("list-item", "The comparison boundary is the two selected titles and nothing wider.")]
        findings = run(page_gates.gate_caveat_heavy, 33, page(said))
        self.assertEqual([f["code"] for f in findings], ["CAVEAT_HEAVY"])
        self.assertGreater(findings[0]["measured"]["caveats"], page_gates.THRESHOLDS["caveats_max"])

    def test_a_finding_in_contrastive_form_is_not_a_hedge(self):
        """The first version of this gate fired on the sharpest line in a
        reference deck. "Education does not decide the city; it decides the
        neighborhood" is a finding whose negation sets up its positive clause."""
        said = [text("list-item", "Education does not decide the city; it decides the neighborhood."),
                text("list-item", "The two state scales are set separately and are not comparable."),
                text("list-item", "Pay bands overlap; the role, not the salary, separates the offers.")]
        self.assertEqual(run(page_gates.gate_caveat_heavy, 4, page(said)), [])


class TableSchemaTests(unittest.TestCase):
    """The same table, invented over and over."""

    def schema_pages(self, headers, count, start=0):
        out = []
        for i in range(count):
            rows = [[f"Row {r}", f"Marvel note {i}{r}", f"DC note {i}{r}"] for r in range(4)]
            out.append(page(table(rows, headers), ident=f"s{start + i:02d}"))
        return out

    def test_one_schema_repeated_across_the_deck_is_reported(self):
        slides = self.schema_pages(["Dimension", "Marvel examples", "DC examples"], 14)
        findings = run(page_gates.gate_table_schema_flat, slides, list(range(len(slides))))
        self.assertEqual([f["code"] for f in findings], ["TABLE_SCHEMA_FLAT"])
        self.assertEqual(findings[0]["measured"]["count"], 14)
        self.assertIn("poured into", findings[0]["repair"])

    def test_a_deck_whose_tables_differ_passes(self):
        slides = []
        for i, headers in enumerate([["Market", "Prize", "Decision"], ["Wave", "Owner", "Gate"],
                                     ["Segment", "Pool", "Growth"], ["Question", "Evidence", "Gap"],
                                     ["Risk", "Trigger", "Response"], ["Year", "Landmark", "Consequence"],
                                     ["Tier", "Found", "Required"]]):
            slides += self.schema_pages(headers, 1, start=i)
        self.assertEqual(run(page_gates.gate_table_schema_flat, slides, list(range(len(slides)))), [])

    def test_a_deck_with_few_tables_is_not_measured(self):
        slides = self.schema_pages(["Dimension", "Marvel", "DC"], 4)
        self.assertEqual(run(page_gates.gate_table_schema_flat, slides, list(range(len(slides)))), [])


class ContradictedShareTests(unittest.TestCase):
    """A percentage the page's own counts do not give.

    Found on a *reference* deck by a reader, not by anything in this repository
    - which is the point. An example deck printed four rings (80% have access, 52%
    require guidelines, 38% limit tools, 12% have no access) over a bar chart
    labelled "17 of 33", "12 of 33", "4 of 33". 17 + 12 = 29 of 33 is 88%, and
    the page's own 12% is what makes 80% provably wrong. Two bullets beside it
    were wrong the same way. Every threshold in this repository is calibrated
    against four decks, and one of them could not add up.
    """

    def page_with(self, *lines, counts=("17 of 33", "12 of 33", "4 of 33")):
        nodes = [text("category-note", c) for c in counts]
        nodes += [text("metric-value", line) if line.endswith("%") else text("list-item", line)
                  for line in lines]
        return page(nodes)

    def test_a_share_the_counts_do_not_give_is_reported(self):
        findings = run(page_gates.gate_contradicted_share, 16, self.page_with("80%"))
        self.assertEqual([f["code"] for f in findings], ["CONTRADICTED_SHARE"])
        self.assertEqual(findings[0]["measured"]["claimed"][0], {"said": "80%", "nearest": 88})

    def test_the_shares_the_counts_do_give_pass(self):
        # 4, 12, 17 over 33 reach 12%, 36%, 48%, 52%, 64%, 88%, 100%.
        for share in ["88%", "52%", "12%", "64%", "36%"]:
            with self.subTest(share=share):
                self.assertEqual(run(page_gates.gate_contradicted_share, 16, self.page_with(share)), [])

    def test_a_share_within_one_count_is_the_author_rounding(self):
        """38% against a reachable 36% is one institution out of 33.

        The first version of this gate flagged it, and it is a second survey
        question over the same base rather than a contradiction. Eight points out
        is not rounding; three is.
        """
        self.assertEqual(run(page_gates.gate_contradicted_share, 16, self.page_with("38%")), [])

    def test_shares_written_as_words_are_read_too(self):
        findings = run(page_gates.gate_contradicted_share, 16, self.page_with("Three quarters of institutions gate access"))
        self.assertEqual([f["code"] for f in findings], ["CONTRADICTED_SHARE"])

    def test_a_page_that_publishes_no_denominator_is_not_measured(self):
        self.assertEqual(run(page_gates.gate_contradicted_share, 1, page([text("list-item", "80% have access")])), [])
        # Two different bases on one page: the page is not making this claim.
        mixed = page([text("category-note", "17 of 33"), text("category-note", "9 of 40"), text("metric-value", "80%")])
        self.assertEqual(run(page_gates.gate_contradicted_share, 1, mixed), [])


class FalsifiabilityTests(unittest.TestCase):
    """A content gate that fires on good work is one that gets switched off."""

    CONTENT_CODES = {"RESTATEMENT", "PLANNING_VOICE", "CAVEAT_HEAVY", "TWIN_CELLS",
                     "TABLE_SCHEMA_FLAT", "CONTRADICTED_SHARE"}


    def test_every_content_code_is_registered_and_documented(self):
        for code in self.CONTENT_CODES:
            with self.subTest(code=code):
                self.assertIn(code, page_gates.GATE_CODES)
                self.assertTrue(page_gates.GATE_CODES[code].strip())


if __name__ == "__main__":
    unittest.main()
