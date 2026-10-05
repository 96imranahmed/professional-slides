"""The governing answer is held up front, by the page that states it.

`CONTENT_ANSWER_UNCARRIED` asked one page title to carry 35% of the answer's
content words. A title holds twelve words, so the answer was capped at about
twenty content words while the storyline critic asked for its reasons, the
named rivals and the thresholds, and an author reworded the answer around the
gate - shorter words, fewer of them - rather than writing it.

What is measured now: the executive summary (the first analytical page of a
deck without one) carries the answer as a whole page - title, points,
highlight, exhibit cells - and its title carries the answer's leading clause,
the verdict, and of the whole answer 35% of its content words or the seven a
full-length title holds, whichever is fewer: a lead that states no verdict is
not carried by repeating it. The deck's titles between them still cover the
answer. The message names the fields the gate reads and the page it tested.
"""
from __future__ import annotations

import json
import unittest

from node_probe import ROOT, run_node

GATES = "file://" + str(ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "content_gates.mjs")

# A reasoned answer: the verdict, its reasons, the rivals by name and the
# thresholds - 36 content words, which no twelve-word title carries 35% of.
ANSWER = ("Yes. Northvale can reach sixty million journeys by filling the off-peak, because half of its off-peak seats run empty "
          "and stations served every half hour grew four times as fast as hourly ones. Westmoor and Tideway already carry "
          "nearly half their journeys off-peak; electrification follows once the power upgrade is delivered, and fare reform comes last.")
QUESTION = "Can Northvale reach sixty million journeys a year, and how?"

TITLES = [
    "Northvale can reach sixty million journeys by filling the off-peak",
    "Half of off-peak seats run empty across the network",
    "Stations served every half hour grew four times as fast as hourly ones",
    "Westmoor and Tideway already carry nearly half their journeys off-peak",
    "Electrification follows once the power upgrade is delivered",
    "Fare reform comes last, after a year of the new timetable",
    "Peak trains are full on every line",
    "The depot extension opens before the first added train runs",
    "Crews are recruited a year ahead of the timetable change",
]
SUMMARY_POINTS = [
    "Half of the off-peak seats run empty, and stations served every half hour grew four times as fast as hourly ones.",
    "Westmoor and Tideway already carry nearly half their journeys off-peak on the timetable Northvale plans.",
    "Electrification follows once the power upgrade is delivered; fare reform comes last.",
]


def plan(titles=TITLES, points=SUMMARY_POINTS, answer=ANSWER, role="executive-summary", **over):
    pages = []
    for i, title in enumerate(titles):
        page = {"id": f"p{i + 1:02d}", "n": i + 1, "claim": title, "settles": {"kind": "count", "what": f"the measured series behind page {i + 1}"},
                "adds": None, "highlight": "four times" if i == 0 else None}
        if i == 0:
            if role:
                page["role"] = role
            if points is not None:
                page["textPlan"] = [{"id": "t", "role": "title", "text": title}] + [
                    {"id": f"b{k}", "role": "body", "text": text} for k, text in enumerate(points)] + [
                    {"id": "s", "role": "source", "text": "Source: illustrative"}]
        pages.append(page)
    return {"schema": "professional-slides.content/v1", "id": "t", "question": QUESTION, "answer": answer, "pages": pages, **over}


def answer_findings(content, options="{}"):
    return run_node(f"""
import {{ runContentGates }} from '{GATES}';
const report = runContentGates({json.dumps(content)}, {options});
console.log(JSON.stringify({{ findings: report.findings.filter((f) => f.code === 'CONTENT_ANSWER_UNCARRIED') }}));
""")["findings"]


class AnswerUpFrontTests(unittest.TestCase):
    def test_a_long_reasoned_answer_passes_when_the_summary_carries_it(self):
        self.assertEqual(answer_findings(plan()), [])

    def test_the_old_rule_would_have_refused_that_answer(self):
        # The measure that was replaced, computed here so the test says what
        # changed: the best single title carries well under 35% of the answer.
        result = run_node(f"""
import {{ contentWords }} from '{GATES}';
const answer = contentWords({json.dumps(ANSWER)});
const best = Math.max(...{json.dumps(TITLES)}.map((title) => {{ const t = contentWords(title); return [...answer].filter((w) => t.has(w)).length / answer.size; }}));
console.log(JSON.stringify({{ words: answer.size, best }}));
""")
        self.assertGreater(result["words"], 30)
        self.assertLess(result["best"], 0.35)

    def test_it_fails_when_the_summary_does_not_carry_it(self):
        thin = ["Growth is possible.", "Several levers exist.", "Timing matters."]
        [finding] = answer_findings(plan(points=thin))
        self.assertEqual(finding["rule"], "CONTENT_ANSWER_UNCARRIED.upfront")
        self.assertEqual(finding["severity"], "blocking")
        self.assertEqual(finding["id"], "p01")
        self.assertLess(finding["measured"]["upFront"], 0.6)
        self.assertIn("`p01` (the executive summary)", finding["repair"])
        self.assertIn("points", finding["repair"])

    def test_it_fails_when_the_summary_title_does_not_lead_with_the_verdict(self):
        titles = ["Three levers, in order, over five years"] + TITLES[1:] + [TITLES[0]]
        [finding] = answer_findings(plan(titles=titles))
        self.assertEqual(finding["rule"], "CONTENT_ANSWER_UNCARRIED.upfront")
        self.assertLess(finding["measured"]["lead"], 0.5)
        self.assertNotIn("pageMissing", finding["measured"])  # the page as a whole still carries the answer
        self.assertIn("title", finding["repair"])
        # The page named is the executive summary, not the page whose title is closest.
        self.assertEqual(finding["id"], "p01")

    def test_the_executive_summary_is_the_page_named_wherever_it_sits(self):
        # A statement page ahead of the summary is not the page the answer is held on.
        content = plan()
        opener = {"id": "p00", "n": 0, "claim": "The off-peak is where the growth is", "settles": {"kind": "qualitative", "what": "the deck's one sentence"}, "adds": None}
        content["pages"] = [opener] + content["pages"]
        self.assertEqual(answer_findings(content), [])
        content["pages"][1]["textPlan"] = [{"id": "t", "role": "title", "text": TITLES[0]}, {"id": "b", "role": "body", "text": "Growth is possible."}]
        [finding] = answer_findings(content)
        self.assertEqual(finding["id"], "p01")

    def test_a_page_whose_copy_is_not_written_yet_is_held_to_its_title(self):
        # A draft's deferred page and a page that did not compose have no copy
        # to read; the title's lead is still held.
        for mark in ({"deferred": True}, {"uncomposed": True}):
            content = plan(points=["Growth is possible."])
            content["pages"][0].update(mark)
            self.assertEqual(answer_findings(content), [], mark)
        content = plan(points=["Growth is possible."])
        self.assertEqual(answer_findings(content, "{ uncomposed: new Set(['p01']) }"), [])
        self.assertTrue(answer_findings(content))

    def test_a_page_that_did_not_compose_still_counts_toward_the_answer(self):
        # Its claim is the deck's, so the titles' coverage does not fall
        # because a page failed to compose.
        content = plan()
        with_all = answer_findings(content)
        without = answer_findings(content, "{ uncomposed: new Set(['p03', 'p04', 'p05']) }")
        self.assertEqual(with_all, [])
        self.assertEqual(without, [])

    def test_coverage_is_still_held(self):
        titles = [TITLES[0]] + [f"A page about something else entirely, number {i}" for i in range(8)]
        findings = answer_findings(plan(titles=titles))
        rules = [f["rule"] for f in findings]
        self.assertIn("CONTENT_ANSWER_UNCARRIED.coverage", rules)
        coverage = next(f for f in findings if f["rule"].endswith("coverage"))
        self.assertLess(coverage["measured"]["coverage"], 0.6)

    def test_the_lead_is_the_verdict_before_the_reasons(self):
        result = run_node(f"""
import {{ answerLead }} from '{GATES}';
const leads = [{json.dumps(ANSWER)}, 'Choose the Park Slope flat, unless the role is in the city', 'Alder leads on reach and price; Birch can pass it by FY31', 'The annual price should hold: the margin is in the service contract'].map(answerLead);
console.log(JSON.stringify({{ leads }}));
""")
        self.assertEqual(result["leads"], ["Northvale can reach sixty million journeys by filling the off-peak", "Choose the Park Slope flat",
                                           "Alder leads on reach and price", "The annual price should hold"])

    def test_the_lead_is_a_clause_with_a_verdict_not_the_subject_before_a_break(self):
        # "Subject: verdict" led with the subject alone, so a title that only
        # named the subject carried all of the lead. A lead too short to say
        # anything, and a label before a colon, is read on with the next clause.
        result = run_node(f"""
import {{ answerLead, CONTENT_THRESHOLDS }} from '{GATES}';
const leads = ['Northfield: expand capacity in the northern region now because margins there are double', 'The northern depot expansion programme: approve the second shift now',
  'Park Slope, unless the role is in the city', 'Hold the price: the margin is in the service contract', 'Yes. Northfield - expand in the north now, because margins are double',
  'It depends: if demand holds then expand', 'Northfield'].map(answerLead);
console.log(JSON.stringify({{ leads, floor: CONTENT_THRESHOLDS.answerLeadWordsMin }}));
""")
        self.assertEqual(result["floor"], 3)
        self.assertEqual(result["leads"], [
            "Northfield: expand capacity in the northern region now",                # one word before the colon is a name
            "The northern depot expansion programme: approve the second shift now",  # four content words and no verb: still a label
            "Park Slope, unless the role is in the city",                            # two content words say too little alone
            "Hold the price: the margin is in the service contract",
            "Northfield - expand in the north now",                                  # the opener passed over, the name read on
            "It depends: if demand holds then expand",
            "Northfield"])                                                           # nothing follows: the whole answer

    def test_a_clause_before_a_colon_is_told_from_a_label_by_its_shape_not_by_a_list_of_verbs(self):
        # A run's answer opened "Harbour remains the region's strongest all-round lending group: it leads ...", and the gate
        # read past the colon because "remains" was not on its closed list of verbs: the title was asked for a share of two
        # clauses and refused. Whether the text before a colon says something is read off its shape - an auxiliary or a
        # negation, a second noun phrase opening inside it, the next clause taking it up with a pronoun - so a verb needs
        # no list to be one, and a noun phrase that names the subject is still read on.
        clauses = {
            "Harbour remains the region's strongest all-round lending group: it leads every rival that reports on deposits and profit": "Harbour remains the region's strongest all-round lending group",
            "Harbour remains the region's strongest all-round lending group: among five lenders the lead holds on four conditions": "Harbour remains the region's strongest all-round lending group",
            "Harbour keeps its lead in the region: scale, margin and card volume all favour it": "Harbour keeps its lead in the region",
            "The merger creates no value for shareholders: decline the offer": "The merger creates no value for shareholders",
            "Renting costs less than buying over ten years: rent the Park Slope flat": "Renting costs less than buying over ten years",
            "Three lenders outgrew their deposits: funding, not demand, limits growth": "Three lenders outgrew their deposits",
            "Northern capacity repays every pound inside two years: expand now": "Northern capacity repays every pound inside two years",
            "The annual price should hold: the margin is in the service contract": "The annual price should hold",
            "Northern margins doubled southern margins: they justify the second shift": "Northern margins doubled southern margins",
        }
        labels = [
            "Northfield: expand capacity in the northern region now",
            "The northern depot expansion programme: approve the second shift now",
            "Harbour Credit Union: funding first",
            "Our recommendation for the northern region: add the second shift",
            "Funding costs and deposit growth in the northern region: the margin narrows from FY27",
            "Recommendation: expand",
            # A bare verb over a bare noun shows none of the three signs, and is read on: the stricter reading.
            "Alder beats Birch: reach and price both favour Alder",
        ]
        result = run_node(f"""
import {{ answerLead }} from '{GATES}';
console.log(JSON.stringify({{ clauses: {json.dumps(list(clauses))}.map(answerLead), labels: {json.dumps(labels)}.map(answerLead) }}));
""")
        self.assertEqual(result["clauses"], list(clauses.values()))
        self.assertEqual(result["labels"], labels)

    def test_a_label_is_told_from_its_own_phrase_whatever_preposition_or_date_it_carries(self):
        # A review found labels read as the answer's whole lead: a preposition the list of governors lacked ("after",
        # "versus", "before") left the determiner behind it looking like a verb's object, a determiner over a calendar unit
        # ("this quarter") looked like one too, and a possessive opening the next clause ("its lead is narrow") was taken for
        # a pronoun taking the label up as a subject. Each is decided from the phrase: a title that only repeats the label
        # then carries a share of the verdict, not all of the lead.
        labels = [
            "Verdict after all three tests: Northfield should expand in the north and exit the south",
            "Position versus the peers on cost: Alder leads on scale and trails on margin",
            "Outcome before any restructuring charge: profit rises 12% on flat revenue",
            "Answer this quarter for lending: hold the rate and widen the book in the north",
            "Northfield retail banking division: its lead is narrow and rests on two branches",
            "Findings since the last board meeting: demand held and costs fell",
            "Outlook despite the new entrant: the lead holds for two more years",
        ]
        clauses = {
            # A verb's object is still an object behind a longer phrase, and a subject pronoun still takes a clause up.
            "Harbour keeps its lead despite the new entrant: defend the northern branches": "Harbour keeps its lead despite the new entrant",
            "Three lenders outgrew their deposits after the rate rise: funding limits growth": "Three lenders outgrew their deposits after the rate rise",
            "Northern margins doubled southern margins: they justify the second shift": "Northern margins doubled southern margins",
            "Harbour won every tender this year: it should bid for the northern contract": "Harbour won every tender this year",
        }
        result = run_node(f"""
import {{ answerLead }} from '{GATES}';
console.log(JSON.stringify({{ clauses: {json.dumps(list(clauses))}.map(answerLead), labels: {json.dumps(labels)}.map(answerLead) }}));
""")
        self.assertEqual(result["labels"], labels)
        self.assertEqual(result["clauses"], list(clauses.values()))

    def test_a_title_that_repeats_a_label_does_not_lead_a_revision_with_its_answer_either(self):
        # The lead is read the same way for a deck being revised: under the current rules a title that only repeats the
        # label before the colon is refused, and a revision recorded before the up-front rule hears it as an advisory.
        answer = ("Verdict after all three tests: expand capacity in the northern region now because margins there are double the southern margins "
                  "and the depot has spare capacity.")
        titles = ["The verdict after all three tests is set out below", "Margins in the northern region are double the southern margins",
                  "The depot has spare capacity for another shift", "Expand costs are recovered inside two years on current volumes"] + TITLES[4:]
        points = ["Expand capacity in the northern region now: margins there are double the southern margins.", "The depot has spare capacity for the added shift."]
        for options, severity in (("{ deck: { workflow: 'existing_deck_revision', rulesVersion: 6 } }", "blocking"), ("{}", "blocking"),
                                  ("{ deck: { workflow: 'existing_deck_revision', rulesVersion: 4 } }", "advisory")):
            upfront = [f for f in answer_findings(plan(titles=titles, points=points, answer=answer), options) if f["rule"].endswith("upfront")]
            self.assertEqual([f["severity"] for f in upfront], [severity], options)
            # The lead the title is held to is the verdict behind the label, which this title does not state.
            self.assertLess(upfront[0]["measured"]["lead"], 0.5, options)
            self.assertIn("expand", upfront[0]["measured"]["leadMissing"], options)

    def test_the_answer_the_run_wrote_is_carried_by_the_title_that_states_its_verdict(self):
        answer = ("Harbour remains the region's strongest all-round lending group: it leads every rival that reports on deposits, branch network, profit, margin "
                  "and card volume, while Tideway Mutual leads on rated service and Westmoor on growth; the lead is narrowing and rests on four conditions.")
        titles = ["Harbour remains the region's strongest all-round lending group, on four conditions", "Harbour leads every rival that reports on deposits and branch network",
                  "Profit and margin put Harbour ahead of every rival that reports", "Card volume at Harbour is the largest of any regional lender",
                  "Tideway Mutual leads on rated service and Westmoor on growth", "The lead is narrowing as rivals add branches faster"] + TITLES[6:]
        points = ["Harbour leads every rival that reports on deposits, branch network, profit, margin and card volume.", "Tideway Mutual leads on rated service and Westmoor on growth.",
                  "The lead is narrowing and rests on four conditions."]
        findings = answer_findings(plan(titles=titles, points=points, answer=answer))
        self.assertEqual([f for f in findings if f["rule"].endswith("upfront")], [])

    def test_a_title_that_only_names_the_subject_does_not_lead_with_the_answer(self):
        answer = ("Northfield: expand capacity in the northern region now because margins there are double the southern margins "
                  "and the depot has spare capacity.")
        titles = ["Northfield has three options and a board meeting in March", "Margins in the northern region are double the southern margins",
                  "The depot has spare capacity for another shift", "Expand costs are recovered inside two years on current volumes"] + TITLES[4:]
        points = ["Expand capacity in the northern region now: margins there are double the southern margins.", "The depot has spare capacity for the added shift."]
        [finding] = answer_findings(plan(titles=titles, points=points, answer=answer))
        self.assertEqual([finding["rule"], finding["severity"]], ["CONTENT_ANSWER_UNCARRIED.upfront", "blocking"])
        self.assertEqual(finding["measured"]["lead"], 0.2)
        self.assertEqual(finding["measured"]["leadMissing"], ["expand", "capacity", "northern", "region"])
        self.assertIn('the answer\'s leading clause ("Northfield: expand capacity in the northern region now")', finding["repair"])
        # The verdict in the title clears it.
        stated = ["Northfield should expand capacity in the northern region now"] + titles[1:]
        self.assertEqual(answer_findings(plan(titles=stated, points=points, answer=answer)), [])


    def test_a_title_that_repeats_an_opener_which_states_no_verdict_is_refused(self):
        # A lead can be a clause that says nothing: "The board has a clear
        # decision ahead: expand ...". A title repeating it carried the whole
        # lead and passed, where the single-title rule had refused it. The
        # opening title also carries its share of the whole answer.
        body = ("expand northern capacity now, because northern margins double southern margins, the depot holds spare shifts, competitors announced nothing, "
                "staffing exists locally, the lease runs past 2031 and contracts renew annually.")
        rest = ["Northern margins double southern margins on every product", "The depot holds spare shifts through next winter", "Competitors announced nothing for the next two years",
                "Staffing exists locally for a second shift today", "The lease runs past 2031 without a break clause", "Contracts renew annually on rolling notice periods",
                "Expand costs come back inside two years", "Fuel and wage inflation are the two exposures", "Capacity now is cheaper than capacity later"]
        points = ["Expand northern capacity now: northern margins double southern margins and the depot holds spare shifts.",
                  "Competitors announced nothing, staffing exists locally, the lease runs past 2031 and contracts renew annually."]
        cases = {"The board has a clear decision ahead: " + body: "The board has a clear decision ahead of the March meeting",
                 "Northfield management must now decide between three options. " + body[0].upper() + body[1:]: "Northfield management must now decide between three options"}
        for answer, title in cases.items():
            [finding] = answer_findings(plan(titles=[title] + rest, points=points, answer=answer))
            self.assertEqual([finding["rule"], finding["severity"], finding["id"]], ["CONTENT_ANSWER_UNCARRIED.upfront", "blocking", "p01"])
            self.assertEqual(finding["measured"]["lead"], 1)        # the title carries the whole lead,
            self.assertNotIn("pageMissing", finding["measured"])     # the page the whole answer,
            self.assertLess(finding["measured"]["title"], 0.35)      # and the title too little of it
            self.assertIn("expand", finding["measured"]["titleMissing"])
            self.assertIn("a title that repeats an opening clause which states no verdict leads with nothing", finding["repair"])
            self.assertRegex(finding["repair"], r"carries \d+ of the answer's \d+ content words and is held to 7 - 35% of them, or the 7 a full-length title holds where that is fewer")
        # An answer that leads with its verdict, and a title that states it, clear it, whatever the answer's length.
        verdict = body[0].upper() + body[1:]
        self.assertEqual(answer_findings(plan(titles=["Expand northern capacity now: margins double southern, depot holds spare shifts"] + rest, points=points, answer=verdict)), [])

    def test_the_title_s_share_is_35_percent_or_what_a_full_length_title_holds(self):
        result = run_node(f"""
import fs from 'node:fs';
import {{ runContentGates, contentWords, titleContentWords, CONTENT_THRESHOLDS }} from '{GATES}';
import {{ TEXT_LIMITS }} from './skills/professional-slides/runtime/page-types.mjs';
import {{ PLAN }} from './skills/professional-slides/runtime/weight.mjs';
const words = (n, from = 0) => Array.from({{ length: n }}, (_, i) => 'lever' + 'abcdefghijklmnopqrstuvwxyz'[(from + i) % 26] + 'abcdefghijklmnopqrstuvwxyz'[Math.floor((from + i) / 26)]);
// An answer of `n` content words whose opening title carries `carried` of them; the page and the other titles carry the rest.
const held = (n, carried) => {{ const all = words(n); const answer = all.slice(0, 3).join(' ') + '. ' + all.slice(3).join(' ') + '.';
  const pages = Array.from({{ length: 9 }}, (_, i) => ({{ id: 'p' + i, n: i + 1, claim: i === 0 ? all.slice(0, carried).join(' ') : all.slice((i - 1) * 6, i * 6).join(' ') + ' moved first', settles: {{ kind: 'count', what: 'the measured series behind the page' }}, adds: null,
    ...(i === 0 ? {{ role: 'executive-summary', highlight: 'x', textPlan: [{{ id: 't', role: 'title', text: all.slice(0, carried).join(' ') }}, {{ id: 'b', role: 'body', text: all.join(' ') }}] }} : {{}}) }}));
  const found = runContentGates({{ schema: 'professional-slides.content/v1', id: 't', question: 'Which levers move first?', answer, pages }}, {{}}).findings.filter((f) => f.rule === 'CONTENT_ANSWER_UNCARRIED.upfront');
  return found.length ? Object.keys(found[0].measured).filter((key) => key.endsWith('Missing')) : []; }};
const titles = fs.readdirSync('./skills/professional-slides/examples').filter((f) => f.endsWith('.pages.json')).flatMap((f) => JSON.parse(fs.readFileSync('./skills/professional-slides/examples/' + f, 'utf8')).pages)
  .filter((page) => page.type && typeof page.title === 'string').map((page) => page.title.replace(/[{{][{{][^}}]*[}}][}}]/g, 'x'));
const share = titles.map((title) => contentWords(title).size / title.trim().split(' ').filter(Boolean).length).sort((a, b) => a - b);
console.log(JSON.stringify({{ cap: titleContentWords(), limits: [TEXT_LIMITS.titleWords, PLAN.titleWords.max], share: CONTENT_THRESHOLDS.titleContentShare, carriedMin: CONTENT_THRESHOLDS.answerCarriedMin,
  short: [held(10, 3), held(10, 4)], middle: [held(18, 6), held(18, 7)], long: [held(30, 6), held(30, 7)], longer: [held(48, 6), held(48, 7)],
  titles: titles.length, median: share[Math.floor(share.length / 2)] }}));
""")
        # Derived from the title word limit, not written down: twelve words at the content-word share of a title's words.
        self.assertEqual(result["limits"][0], result["limits"][1])
        self.assertEqual(result["cap"], int(result["limits"][0] * result["share"] + 1e-9))
        self.assertEqual(result["cap"], 7)
        # A short answer is held to 35% of its words, as every deck's best title once was...
        self.assertEqual(result["short"], [["titleMissing"], []])       # 3 of 10 is under 35%, 4 is over
        self.assertEqual(result["middle"], [["titleMissing"], []])     # 35% of 18 is 6.3
        # ...and a long one to what a full-length title holds, however long it runs.
        self.assertEqual(result["long"], [["titleMissing"], []])       # 35% of 30 is 10.5; seven are asked
        self.assertEqual(result["longer"], [["titleMissing"], []])
        # The share is the examples' own: half their titles hold that share of content words or less.
        self.assertGreater(result["titles"], 60)
        self.assertAlmostEqual(result["median"], result["share"], delta=0.05)


class AnswerMessageTests(unittest.TestCase):
    """The message names the fields the gate reads; applied literally it clears."""

    def test_a_deck_with_only_question_or_only_brief_is_read(self):
        result = run_node("""
import { deriveContent } from './skills/professional-slides/runtime/derive-content.mjs';
const derive = (deck) => deriveContent({ id: 'd', slides: [], ...deck }, { slides: [] }).question;
console.log(JSON.stringify({ question: derive({ question: 'Q?' }), brief: derive({ brief: 'B?' }), both: derive({ question: 'Q?', brief: 'B?' }), none: derive({}) }));
""")
        self.assertEqual(result, {"question": "Q?", "brief": "B?", "both": "Q?", "none": None})

    def test_the_missing_field_message_names_what_to_write_and_writing_it_clears_it(self):
        content = plan()
        del content["question"]
        [finding] = answer_findings(content)
        self.assertEqual(finding["measured"], {"question": False, "answer": True})
        self.assertIn("`question` (or `brief`)", finding["repair"])
        self.assertIn("the question it is asked", finding["repair"])
        self.assertNotIn("the answer it gives", finding["repair"])
        content["question"] = QUESTION
        self.assertEqual(answer_findings(content), [])

    def test_the_up_front_repair_applied_literally_clears_the_finding(self):
        # "Write the verdict in the title ... state the reasons in the page's points, in the answer's own words."
        titles = ["Three levers, in order, over five years"] + TITLES[1:] + [TITLES[0]]
        broken = plan(titles=titles, points=["Growth is possible."])
        [finding] = answer_findings(broken)
        self.assertIn("leadMissing", finding["measured"])
        self.assertIn("pageMissing", finding["measured"])
        repaired = plan(titles=[TITLES[0]] + TITLES[1:], points=SUMMARY_POINTS)
        self.assertEqual(answer_findings(repaired), [])

    def test_an_older_revision_hears_the_up_front_rule_as_an_advisory(self):
        thin = plan(points=["Growth is possible."])
        [now] = answer_findings(thin)
        older = answer_findings(thin, "{ deck: { workflow: 'existing_deck_revision', rulesVersion: 4 } }")
        self.assertEqual(now["severity"], "blocking")
        upfront = next(f for f in older if f["rule"].endswith("upfront"))
        self.assertEqual(upfront["severity"], "advisory")
        self.assertEqual(upfront["waived"], {"rulesVersion": 4, "introducedIn": 5})

    def test_an_older_revision_is_still_held_to_the_rule_it_was_recorded_under(self):
        # A revision recorded under rules version 3 or 4 was blocked by the
        # single-title rule, and after the up-front rule replaced it heard
        # only an advisory: held to neither. It keeps the rule it had.
        thin = plan(points=["Growth is possible."])  # no title carries 35% of this long answer
        revision = lambda version: f"{{ deck: {{ workflow: 'existing_deck_revision', rulesVersion: {version} }} }}"
        for version in (3, 4):
            findings = answer_findings(thin, revision(version))
            self.assertEqual(sorted((f["rule"], f["severity"]) for f in findings),
                             [("CONTENT_ANSWER_UNCARRIED.coverage", "blocking"), ("CONTENT_ANSWER_UNCARRIED.upfront", "advisory")], version)
            old = next(f for f in findings if f["rule"].endswith("coverage"))
            self.assertLess(old["measured"]["carried"], 0.35)
            self.assertEqual(old["threshold"]["carried"], 0.35)
            self.assertIn("No single page states the answer", old["repair"])
            self.assertIn(f"rules version {version}", old["repair"])
        # Under the current rules, and for a new deck, the up-front rule alone: the old one is not asked as well.
        for options in (revision(5), "{}", "{ deck: { workflow: 'new_deck', rulesVersion: 4 } }"):
            self.assertEqual([(f["rule"], f["severity"]) for f in answer_findings(thin, options)], [("CONTENT_ANSWER_UNCARRIED.upfront", "blocking")], options)
        # A revision that predates the single-title rule too hears both as advisories, as it did.
        self.assertEqual({f["severity"] for f in answer_findings(thin, revision(2))}, {"advisory"})
        # And an older revision whose one title does carry the answer passes the rule it was recorded under.
        short = "Northvale can reach sixty million journeys by filling the off-peak seats."
        self.assertEqual(answer_findings(plan(points=["Growth is possible."], answer=short), revision(4)), [])
        # The record carries the standing either way.
        standings = run_node(f"""
import {{ runContentGates }} from '{GATES}';
const keys = (deck) => runContentGates({json.dumps(thin)}, {{ deck }}).standings.filter((s) => s.code === 'CONTENT_ANSWER_UNCARRIED').map((s) => s.key);
console.log(JSON.stringify({{ older: keys({{ workflow: 'existing_deck_revision', rulesVersion: 4 }}), current: keys({{}}) }}));
""")
        self.assertIn("carried", standings["older"])
        self.assertNotIn("carried", standings["current"])


if __name__ == "__main__":
    unittest.main()
