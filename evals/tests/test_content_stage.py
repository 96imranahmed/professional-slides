"""The stage that did not exist.

A 50-page deck recorded thirteen page architectures, 0.93 style entropy and a
stated reason on all fifty pages — the best layout numbers ever measured in this
repository — and carried one chart, twenty-eight pages opening with the literal
word "Interpretation:", and eighteen tables on two invented schemas. A reader
rated it 2 out of 10.

Layout planning passed with distinction; content design never happened. They
were one artefact — a dot-dash row asking for the claim, the exhibit, the variant
and the architecture together — so choosing a shape felt like choosing the
evidence, and nothing noticed that the evidence had not been chosen.

`content_gates.mjs` is the split. A content page carries a claim, what settles it
and of what kind, what the commentary adds that the exhibit cannot, and the
phrase to highlight. There is nowhere to name a component, so there is nothing to
mistake for a decision about evidence.
"""

from __future__ import annotations

import json
import unittest

from node_probe import ROOT, run_node

GATES = "file://" + str(ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "content_gates.mjs")


def gate(content):
    return run_node(f"""
import {{ runContentGates }} from '{GATES}';
console.log(JSON.stringify(runContentGates({json.dumps(content)})));
""")


CLAIMS = [
    "Readiness decides the first wave and three markets carry full data today",
    "The prize sits behind the longest filings, which no later start recovers",
    "Cost to serve confirms the order rather than contesting it",
    "Two markets stay open and re-enter at the month-thirteen gate",
    "The committee approves a gate rather than an eighteen-month sequence",
    "Germany's regulatory clock is the only one a head start cannot shorten",
    "Spend peaks in wave two, where the run-rate also triples",
    "Three tests at month seven release the budget for the second wave",
    "Every wave has one owner and one condition that opens it",
    "Four conditions would change the order and three are testable early",
    "The tail is real but small: five markets hold a fifth of the prize",
    "Portugal launches on the Spanish build, which is why it goes last",
]


def page(n, **over):
    base = {"n": n, "claim": CLAIMS[(n - 1) % len(CLAIMS)],
            "settles": {"kind": "count", "what": "markets clearing the hurdle"},
            "adds": "Wave one can start before the regulatory clock on Germany runs out",
            "highlight": "three of twelve"}
    base.update(over)
    return base


# The governing question and answer the claims above add up to. A content plan
# without them is a set of proofs for a promise nobody wrote down, which is what
# CONTENT_ANSWER_UNCARRIED exists to catch - so the fixture carries them, and
# the gate's own test removes them deliberately.
QUESTION = "Which markets go in the first wave, and what opens the second?"
ANSWER = ("Readiness decides the first wave and three markets carry it; the committee approves a "
          "gate at month seven rather than an eighteen-month sequence.")


def deck(pages, **over):
    return {"schema": "professional-slides.content/v1", "id": "t",
            "question": QUESTION, "answer": ANSWER, "pages": pages, **over}


class ClaimTests(unittest.TestCase):
    def test_a_topic_label_is_not_a_claim(self):
        # "Origins" is a section name. A page proves something.
        report = gate(deck([page(1, claim="Origins")] + [page(i) for i in range(2, 10)]))
        codes = [f["code"] for f in report["findings"]]
        self.assertIn("CONTENT_NO_CLAIM", codes)
        self.assertEqual(next(f for f in report["findings"] if f["code"] == "CONTENT_NO_CLAIM")["page"], 1)

    def test_two_pages_proving_the_same_thing_are_reported(self):
        same = "Readiness decides the first wave and only three markets carry full data"
        pages = [page(i) for i in range(1, 10)]
        pages[2]["claim"] = same
        pages[6]["claim"] = same
        codes = [f["code"] for f in gate(deck(pages))["findings"]]
        self.assertIn("CONTENT_CLAIM_REPEATS", codes)


class EvidenceKindTests(unittest.TestCase):
    """The one field the layout stage reads, and the one-chart failure."""

    def test_a_deck_that_settles_nothing_countable_is_reported(self):
        pages = [page(i, settles={"kind": "qualitative", "what": "a premise"}) for i in range(1, 11)]
        finding = next(f for f in gate(deck(pages))["findings"] if f["code"] == "CONTENT_UNMEASURED")
        self.assertEqual(finding["measured"]["pages"], 10)
        self.assertIn("cannot", finding["repair"])

    def test_a_third_qualitative_is_allowed(self):
        pages = [page(i) for i in range(1, 10)]
        for i in (0, 1, 2):
            pages[i]["settles"] = {"kind": "qualitative", "what": "a premise"}
        self.assertNotIn("CONTENT_UNMEASURED", [f["code"] for f in gate(deck(pages))["findings"]])

    def test_an_unknown_kind_is_rejected(self):
        pages = [page(i) for i in range(1, 10)]
        pages[0]["settles"] = {"kind": "vibes", "what": "x"}
        self.assertIn("CONTENT_SCHEMA", [f["code"] for f in gate(deck(pages))["findings"]])

    def test_the_report_counts_what_the_deck_measures(self):
        pages = [page(i) for i in range(1, 9)]
        pages[0]["settles"] = {"kind": "qualitative", "what": "a premise"}
        stats = gate(deck(pages))["statistics"]
        self.assertEqual(stats["kinds"]["count"], 7)
        self.assertEqual(stats["kinds"]["qualitative"], 1)
        self.assertEqual(stats["measured"], 0.875)


class AddsTests(unittest.TestCase):
    """The field that did not exist, and the 28 `Interpretation:` pages."""

    def test_a_page_with_no_answer_to_what_the_commentary_adds_is_reported(self):
        pages = [page(i) for i in range(1, 10)]
        pages[0]["adds"] = ""
        finding = next(f for f in gate(deck(pages))["findings"] if f["code"] == "CONTENT_ADDS_NOTHING")
        self.assertEqual(finding["page"], 1)
        self.assertIn("Interpretation", finding["repair"])

    def test_the_claim_again_in_different_words_is_reported(self):
        pages = [page(i) for i in range(1, 10)]
        pages[0]["claim"] = "Avengers and Justice League connect heroes with independent identities"
        pages[0]["adds"] = "Both team concepts connect recognizable heroes with independent identities"
        finding = next(f for f in gate(deck(pages))["findings"] if f["code"] == "CONTENT_ADDS_NOTHING")
        self.assertGreater(finding["measured"]["overlap"], 0.5)

    def test_commentary_that_brings_its_own_argument_passes(self):
        pages = [page(i) for i in range(1, 10)]
        pages[0]["claim"] = "Germany and France hold 36% of the prize behind the longest filings"
        pages[0]["adds"] = "No sequence built on the tail recovers a delay here, so the filings go in month one"
        self.assertNotIn("CONTENT_ADDS_NOTHING", [f["code"] for f in gate(deck(pages))["findings"]])


class SeparationTests(unittest.TestCase):
    """There is nowhere to put a component, which is the point."""

    def test_naming_a_shape_in_the_content_file_is_reported(self):
        for field, value in [("exhibit", "table"), ("architecture", "exhibit-left"),
                             ("variant", "harvey"), ("anchors", ["photo: x"]), ("insight", "filled")]:
            with self.subTest(field=field):
                pages = [page(i) for i in range(1, 10)]
                pages[0][field] = value
                finding = next(f for f in gate(deck(pages))["findings"] if f["code"] == "CONTENT_LAYOUT_LEAK")
                self.assertIn(field, finding["measured"])
                self.assertIn("two files", finding["repair"])

    def test_a_clean_content_plan_passes(self):
        report = gate(deck([page(i) for i in range(1, 13)]))
        self.assertEqual(report["findings"], [])
        self.assertTrue(report["accepted"])

    def test_a_deck_whose_answer_no_claim_carries_is_reported(self):
        """The deck promises something none of its pages proves.

        This is what `slideworks` did: an answer naming a decline concentrated
        in repriced technology and governance deciding a deployment's reach,
        over nine claims that between them said neither word. Coverage 0.13.
        """
        report = gate(deck([page(i) for i in range(1, 13)],
                           answer="Latency in the Bucharest servicing centre is what caps renewals"))
        finding = next(f for f in report["findings"] if f["code"] == "CONTENT_ANSWER_UNCARRIED")
        self.assertLess(finding["measured"]["coverage"], 0.6)
        self.assertIn("promises something no page proves", finding["repair"])

    def test_a_plan_with_no_question_or_answer_is_reported(self):
        report = gate({"schema": "professional-slides.content/v1", "id": "t",
                       "pages": [page(i) for i in range(1, 13)]})
        finding = next(f for f in report["findings"] if f["code"] == "CONTENT_ANSWER_UNCARRIED")
        self.assertEqual(finding["measured"], {"question": False, "answer": False})

    def test_a_file_without_pages_is_a_schema_finding(self):
        self.assertEqual([f["code"] for f in gate({"schema": "x"})["findings"]], ["CONTENT_SCHEMA"])


class MarvelSpecimenTests(unittest.TestCase):
    """The run that made the case, as content rather than as pages.

    Nine pages transcribed from the deck a reader rated 2 out of 10. Every
    finding below was invisible to the fifty-odd numeric gates it passed.
    """

    SPECIMEN = [
        {"n": 5, "claim": "DC's foundational icons predate Marvel's defining 1960s ensemble",
         "settles": {"kind": "qualitative", "what": "three dated character debuts"},
         "adds": "The different starting points help explain brand associations", "highlight": ""},
        {"n": 7, "claim": "Batman turns personal loss into a sustained mission",
         "settles": {"kind": "qualitative", "what": "the origin"}, "adds": "", "highlight": ""},
        {"n": 8, "claim": "Origins", "settles": {"kind": "qualitative", "what": "x"},
         "adds": "y", "highlight": ""},
        {"n": 10, "claim": "Avengers and Justice League connect heroes with independent identities",
         "settles": {"kind": "qualitative", "what": "two team concepts"},
         "adds": "Avengers and Justice League connect heroes with independent identities",
         "highlight": "", "exhibit": "table", "architecture": "exhibit-full"},
        {"n": 24, "claim": "Secret Wars brings multiple Marvel teams into one bounded event",
         "settles": {"kind": "qualitative", "what": "a twelve-issue series"}, "adds": "z", "highlight": ""},
        {"n": 33, "claim": "DC's screen history predates the MCU's 2008 launch",
         "settles": {"kind": "qualitative", "what": "two dates"}, "adds": "z", "highlight": ""},
        {"n": 37, "claim": "Black Panther and The Dark Knight each exceeded $1 billion worldwide",
         "settles": {"kind": "comparison", "what": "original-release worldwide gross, nominal USD"},
         "adds": "Scale is not a publisher-wide verdict on a sample of two", "highlight": "$1 billion"},
        {"n": 42, "claim": "Batman animation sustains a world through a recurring cast",
         "settles": {"kind": "qualitative", "what": "one series"}, "adds": "z", "highlight": ""},
        {"n": 44, "claim": "Games give both libraries a playable route into their characters",
         "settles": {"kind": "qualitative", "what": "two games"}, "adds": "z", "highlight": ""},
    ]

    def test_the_content_stage_rejects_the_deck_before_a_shape_is_chosen(self):
        report = gate(deck(self.SPECIMEN))
        codes = set(report["countsByCode"])
        self.assertFalse(report["accepted"])
        # Eight of nine pages settle nothing countable: this is the one-chart
        # deck, caught before a single page has a shape.
        self.assertIn("CONTENT_UNMEASURED", codes)
        self.assertGreater(report["countsByCode"]["CONTENT_ADDS_NOTHING"], 1)
        self.assertIn("CONTENT_NO_CLAIM", codes)
        self.assertIn("CONTENT_LAYOUT_LEAK", codes)
        # One page in nine names a phrase to highlight, which clears the floor -
        # the full deck named none across fifty.
        self.assertEqual(report["statistics"]["withHighlight"], 1)

    def test_the_deck_had_countable_evidence_in_its_own_prose(self):
        """Twelve issues, two dates, two grosses — all drawn as diagrams.

        The failure was not that the subject had no numbers. It was that nothing
        asked what would settle each claim until after the shape was picked.
        """
        countable = [p for p in self.SPECIMEN if p["settles"]["kind"] != "qualitative"]
        self.assertEqual(len(countable), 1)
        prose = " ".join(p["settles"]["what"] for p in self.SPECIMEN)
        for number in ["twelve-issue", "two dates", "gross"]:
            self.assertIn(number, prose)


if __name__ == "__main__":
    unittest.main()
