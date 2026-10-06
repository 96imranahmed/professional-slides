"""The hard word floor, the density profile and the review's density pass.

The floor stops a page shipping under the client pages doing its job; the
profile measures the rendered deck the way the corpus was measured; the review
judges every page the profile flags. Together they replace a rationale that
used to let a thin page through.
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from node_probe import run_node  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "skills/professional-slides/runtime"
sys.path.insert(0, str(RUNTIME / "gates"))
import density_profile  # noqa: E402


class BlockExtractionTests(unittest.TestCase):
    def test_blocks_follow_the_corpus_rule(self):
        page = "\n".join([
            "A title that is dropped",
            "",
            "First block has these five words",
            "and runs on to this line",
            "",
            "Axis label",
            "",
            "Second block of seven words here now",
            "Source: dropped as the source line",
            "07",
        ])
        # Title, page number, source line and the two-word label are not blocks.
        self.assertEqual(density_profile.page_blocks(page), [12, 7])
        self.assertEqual(density_profile.body_words(page), 21)

    def test_a_source_that_wraps_is_footer_all_the_way_down(self):
        # The second and third lines of a long source footer are the footer, not two short blocks of body.
        page = "\n".join(["Title of the page", "", "A developed point of about a dozen words that says what follows.", "",
                           "Source: Avison Young, Manhattan office report Q3 2026; Colliers,", "Manhattan office market Q3 2026; CBRE lending", "momentum Q2 2026"])
        self.assertEqual(density_profile.page_blocks(page, {"Title of the page"}), [12])
        self.assertEqual(density_profile.body_words(page, {"Title of the page"}), 12)

    def test_a_kicker_above_the_title_does_not_turn_the_title_into_body(self):
        # A generated page sets its section kicker above the title. The corpus
        # rule drops only the first line, so given the page's header lines the
        # profile drops the kicker and the title both.
        page = "\n".join(["What a page carries", "", "Client chart pages print 26 numbers", "", "Four words of body text here", "Source: dropped"])
        header = {"What a page carries", "Client chart pages print 26 numbers"}
        self.assertEqual(density_profile.page_blocks(page, header), [6])
        self.assertEqual(density_profile.body_words(page, header), 6)
        self.assertEqual(density_profile.body_words(page), 12)


class PopulationTests(unittest.TestCase):
    def test_only_pages_that_carry_prose_are_set_against_the_block_benchmark(self):
        # The benchmark was measured on reference pages chosen by what they print - sixty words, one block of fifteen -
        # and a deck's pages are chosen by the same rule: a chart page whose blocks are its labels is not one.
        self.assertTrue(density_profile.prose_blocks([5, 32, 28]))
        self.assertTrue(density_profile.prose_blocks([60]))
        self.assertFalse(density_profile.prose_blocks([5, 4, 6, 3, 8, 7, 9, 10, 6, 5]), "labels alone, however many")
        self.assertFalse(density_profile.prose_blocks([5, 30]), "one developed block and little else")


class ExecutiveSummaryTests(unittest.TestCase):
    def test_a_summary_carries_up_to_seven_developed_points_with_sub_points(self):
        # The client summary is four to six developed statements with their
        # parts as sub-points, not three bullets and an insight box.
        result = run_node("""
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const points=Array.from({length:6},(_,i)=>({lead:'Statement '+(i+1)+'.',text:'A developed statement with its evidence and what follows from it.',...(i===0?{points:['The first part','The second part']}:{})}));
const spec={schema:'professional-slides.deck/v3',id:'e',cover:{title:'x'},slides:[{title:'The answer the deck argues, stated in one line',role:'executive-summary',shape:'executive-summary',pointsStyle:'prose',points}]};
const page=planDeck(toDeckPlan(spec,'.')).deck.slides.at(-1);
let error=null; try{toDeckPlan({...spec,slides:[{...spec.slides[0],points:[...points,...points]}]},'.');}catch(e){error=e.message;}
console.log(JSON.stringify({items:page.nodes.filter(n=>n.role==='list-item').length,subs:page.nodes.filter(n=>n.role==='list-subitem').map(n=>n.text),error}));
""")
        self.assertEqual(result["items"], 6)
        self.assertEqual(result["subs"], ["The first part", "The second part"])
        self.assertIn("two to seven", result["error"])


class DensityReviewTests(unittest.TestCase):
    def test_every_flagged_page_needs_a_verdict_and_only_right_passes(self):
        result = run_node("""
import { validateDensityReview, reviewOutcome } from './skills/professional-slides/runtime/reviewer.mjs';
const profile={flaggedPages:['s04','s09']};
const deck='Blocks per page sit at the client median; words per block run light against the 56-word target.';
const partial={accepted:true,rating:8.5,findings:[],density:{deck,pages:[{slide:'s04',verdict:'right',reason:'A chart-led page with one line of takeaway, as the client pages set it.'}]}};
const full={...partial,density:{deck,pages:[...partial.density.pages,{slide:'s09',verdict:'too dense',reason:'The third point restates the title to clear the word floor.'}]}};
console.log(JSON.stringify({missing:validateDensityReview(partial,profile),absent:validateDensityReview({accepted:true,findings:[]},profile),
  none:validateDensityReview({accepted:true,findings:[]},null), complete:validateDensityReview(full,profile),
  outcome:reviewOutcome(full), passing:reviewOutcome(partial)}));
""")
        self.assertTrue(any("s09" in e for e in result["missing"]))
        self.assertTrue(result["absent"])
        self.assertEqual(result["none"], [])
        self.assertEqual(result["complete"], [])
        self.assertFalse(result["outcome"]["accepted"])
        self.assertEqual([b["code"] for b in result["outcome"]["blocking"]], ["DENSITY_MISMATCH"])
        self.assertTrue(result["passing"]["accepted"])

    def test_a_right_verdict_on_a_page_outside_the_band_quotes_its_developed_point(self):
        point = ("Four extra peak trains an hour since FY22 have coincided with a 5.1-point fall in Eastern line punctuality: "
                 "each added train leaves less recovery time at the two single-track sections east of Selby, so one late train now delays the next three.")
        result = run_node(f"""
import {{ validateDensityReview, DEVELOPED_POINT_WORDS }} from './skills/professional-slides/runtime/reviewer.mjs';
const profile = {{ flaggedPages: ['p10'], deck: {{ wordsPerBlock: {{ band: [10.2, 22.6] }} }},
  pages: [{{ id: 'p10', task: 'chart-with-commentary', prose: true, blocks: 9, wordsPerBlock: 7.5 }}, {{ id: 'p11', task: 'chart-led', prose: false, blocks: 7, wordsPerBlock: 6.6 }}] }};
const deck = 'Words per block run under the band strong prose pages keep, so the deck reads as labels in places.';
const printed = {{ p10: 'Each extra Eastern line peak train has cost a point of punctuality\\n' + {json.dumps(point)} + '\\nOff-peak trains share none of that conflict.' }};
const review = (entry) => ({{ density: {{ deck, pages: [{{ slide: 'p10', verdict: 'right', reason: 'The first point develops the mechanism behind the fall in punctuality.', ...entry }}] }} }});
console.log(JSON.stringify({{ words: DEVELOPED_POINT_WORDS,
  bare: validateDensityReview(review({{}}), profile, null, printed),
  quoted: validateDensityReview(review({{ point: {json.dumps(point)} }}), profile, null, printed),
  invented: validateDensityReview(review({{ point: {json.dumps(point.replace("three", "four"))} }}), profile, null, printed),
  label: validateDensityReview(review({{ point: 'Off-peak trains share none of that conflict.' }}), profile, null, printed),
  thin: validateDensityReview({{ density: {{ deck, pages: [{{ slide: 'p10', verdict: 'too thin', reason: 'Three labels and one sentence under a two-panel chart.' }}] }} }}, profile, null, printed),
  led: validateDensityReview({{ density: {{ deck, pages: [{{ slide: 'p10', verdict: 'right', reason: 'x'.repeat(30), point: {json.dumps(point)} }}, {{ slide: 'p11', verdict: 'right', reason: 'A chart-led page whose blocks are its labels.' }}] }} }}, profile, null, printed) }}));
""")
        self.assertEqual(result["words"], 25)
        self.assertTrue(any("point" in e and "p10" in e for e in result["bare"]), result["bare"])
        self.assertEqual(result["quoted"], [])
        self.assertTrue(any("not on the page" in e for e in result["invented"]), result["invented"])
        self.assertTrue(result["label"], "a label is not a developed point")
        self.assertEqual(result["thin"], [], "only a verdict of right needs the point")
        self.assertEqual(result["led"], [], "a page that carries no prose is not held to the prose band")


class EvaluationLengthTests(unittest.TestCase):
    def test_an_evaluation_deck_under_fifty_pages_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = {"schema": "professional-slides.deck/v3", "id": "short-eval", "purpose": "evaluation",
                    "cover": {"title": "A short evaluation"},
                    "slides": [{"title": f"Page {i} states one finding in a sentence", "layout": "text",
                                "points": ["A point that says something about the finding."]} for i in range(5)]}
            path = Path(tmp) / "short-eval.deck.json"
            path.write_text(json.dumps(spec))
            run = subprocess.run(["node", str(RUNTIME / "build-deck.mjs"), str(path), str(Path(tmp) / "out"), "--no-render"],
                                 capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn("EVALUATION_TOO_SHORT", run.stderr + run.stdout)


if __name__ == "__main__":
    unittest.main()
