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


class DensityReviewTests(unittest.TestCase):
    def test_every_flagged_page_needs_a_verdict_and_only_right_passes(self):
        result = run_node("""
import { validateDensityReview, reviewOutcome } from './skills/professional-slides/runtime/reviewer.mjs';
const profile={flaggedPages:['s04','s09']};
const deck='Blocks per page sit at the client median; words per block run light against the 56-word target.';
const partial={accepted:true,findings:[],density:{deck,pages:[{slide:'s04',verdict:'right',reason:'A chart-led page with one line of takeaway, as the client pages set it.'}]}};
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
