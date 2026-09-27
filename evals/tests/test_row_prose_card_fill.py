"""Four defects found filling the worked example under the per-column checks.

1. Labelled rows. The rows share the body and centre their bullets and number
   beside a filled label block the row's full height, as a strong deck draws
   them. The columns check read each row's cells as regions of their own, so
   the air above and below the centred bullets in a 164px row was a hole and
   only four rows or more passed. A cell centred beside a filled block the
   row's height is now read with its row, held to the page's bars in pixels.
2. The memo. Its prose was set in equal columns that needed some 500 words to
   reach the foot, against a text page's ceiling of 329. Prose beside a panel
   is now sized to the text at a readable measure and the panel takes the
   rest; the same sizing ends the sidebar's strip, where the copy stopped at
   the paragraph measure 165px short of its column's edge.
3. Highlights matched inside words: "22" lit half of "FY22". The accent, the
   page-level push-down and the compile check now match whole words, and the
   compile check says when a phrase would light half a word.
4. Cards grew to half as much again as their copy and centred it, 80px of air
   above every icon. They are now as tall as their copy at the top of the
   frame.
"""
import json
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402

RUNTIME = "./skills/professional-slides/runtime"

SENTENCES = [
    "All 58 units run in the morning peak and none is held spare, so a failure cancels a train rather than swapping one in.",
    "New units are on order but not before 2029, when electrification releases eleven diesel units for other lines.",
    "Every peak diagram is covered, but 9% of peak shifts rely on rest-day overtime, so a new train would have no driver.",
    "Fourteen drivers in training qualify by mid-2027; the plan assigns them to the off-peak timetable, not to the peak.",
    "The Eastern line runs through two single-track sections where trains in opposite directions wait for each other.",
]


def plan(slides):
    """The planned scene of a v3 deck of `slides`."""
    return run_node(f"""
import {{toDeckPlan}} from '{RUNTIME}/compose.mjs';
import {{planDeck}} from '{RUNTIME}/planner.mjs';
const {{deck}}=planDeck(toDeckPlan({{schema:'professional-slides.deck/v3',id:'d',tracker:false,slides:{json.dumps(slides)}}}));
console.log(JSON.stringify(deck));
""")


def scene_void(slide):
    found = []
    page_gates.gate_scene_void(1, slide, found)
    return found


class LabelledRowsTests(unittest.TestCase):
    ROWS = {2: 4, 3: 2, 4: 2, 5: 2}  # points per row: what a row of that height carries

    def blocks(self, n, metrics):
        out = []
        for at in range(n):
            block = {"label": f"Constraint {at + 1} binds the peak",
                     "points": [SENTENCES[(at + k) % len(SENTENCES)] for k in range(self.ROWS[n])]}
            if metrics:
                block["metric"] = {"value": f"{at + 2}", "label": "sections affected"}
            out.append(block)
        return out

    def test_two_to_five_rows_read_full_with_and_without_numbers(self):
        slides = [{"id": f"r{n}{'m' if m else ''}", "title": f"Four constraints hold the peak where it is, case {n}",
                   "layout": "labelled-rows", "blocks": self.blocks(n, m)} for n in self.ROWS for m in (True, False)]
        deck = plan(slides)
        for slide in deck["slides"]:
            with self.subTest(slide=slide["id"]):
                self.assertEqual(scene_void(slide), [], "rows centred on their label blocks read full")

    def test_a_thin_row_still_reads_as_a_hole(self):
        # One short line centred in a 258px row: 100px of air either side,
        # past the page's own bar, whatever the block beside it.
        slide = plan([{"id": "thin", "title": "Two constraints hold the peak where it is today",
                       "layout": "labelled-rows",
                       "blocks": [{"label": "Fleet", "points": ["No spare units."]}, {"label": "Crews", "points": ["No spare drivers."]}]}])["slides"][0]
        found = scene_void(slide)
        self.assertEqual(len(found), 1)
        self.assertIn("column", found[0]["measured"])

    def test_the_rule_is_one_measure_for_scene_and_render(self):
        # column_bands reads a mask by column for the scene and the PNG alike;
        # a synthetic row shows the rule without either.
        top, bottom = 200, 400
        slide = {"componentInstances": [
            {"component": "side-statement", "frame": {"x": 60, "y": top, "width": 228, "height": bottom - top}},
            {"component": "bullet-list", "frame": {"x": 304, "y": top, "width": 600, "height": bottom - top}}]}

        def mask(ink_from, ink_to):
            rows = [bytearray(page_gates.CANVAS_W) for _ in range(page_gates.FOOTER_TOP)]
            for y in range(top, bottom):
                rows[y][60:288] = b"\x01" * 228          # the filled label block
            for y in range(ink_from, ink_to):
                rows[y][304:904] = b"\x01" * 600         # the bullets
            return rows

        centred = page_gates.column_bands(slide, page_gates.scene_column_rows(mask(250, 350)))
        self.assertIsNone(centred, "centred beside the block, the row reads full")
        top_aligned = page_gates.column_bands(slide, page_gates.scene_column_rows(mask(200, 300)))
        self.assertIsNotNone(top_aligned, "stopping halfway down its row is still a half-empty column")
        self.assertEqual(top_aligned["name"], "right")
        open_row = {"componentInstances": [dict(slide["componentInstances"][1]),
                                           {"component": "paragraph", "frame": {"x": 920, "y": top, "width": 300, "height": bottom - top}}]}
        rows = [bytearray(page_gates.CANVAS_W) for _ in range(page_gates.FOOTER_TOP)]
        for y in range(250, 350):
            rows[y][304:904] = b"\x01" * 600
            rows[y][920:1220] = b"\x01" * 300
        self.assertIsNotNone(page_gates.column_bands(open_row, page_gates.scene_column_rows(rows)),
                             "with no block beside it, centred copy is measured on its own region")


def prose(words):
    """Paragraphs of about `words` words, in four."""
    text, total, at = [], 0, 0
    while total < words:
        sentence = SENTENCES[at % len(SENTENCES)]
        text.append(sentence)
        total += len(sentence.split())
        at += 1
    per = -(-len(text) // 4)
    return [" ".join(text[i * per:(i + 1) * per]) for i in range(4) if text[i * per:(i + 1) * per]]


PANEL = {"kicker": "The order matters", "text": "Introduced second, fare reform adds 1.6 million journeys for the cost that buys 0.4 million first."}


class ProseBesidePanelTests(unittest.TestCase):
    def test_a_memo_of_150_to_330_words_fills_the_page(self):
        slides = [{"id": f"m{n}", "title": "Fare reform should follow the new timetable, not lead it",
                   "layout": "text", "paragraphs": prose(n), "panel": PANEL} for n in (150, 220, 280, 330)]
        slides += [{"id": f"s{n}", "title": "Fare reform should follow the new timetable, not lead it",
                    "layout": "sidebar", "paragraphs": prose(n), "panel": PANEL} for n in (150, 263, 330)]
        for slide in plan(slides)["slides"]:
            with self.subTest(slide=slide["id"]):
                self.assertEqual(scene_void(slide), [])
                paragraphs = [n for n in slide["nodes"] if n.get("role") == "paragraph"]
                panel = next(n for n in slide["nodes"] if n.get("role") == "side-panel")
                foot = max(n["frame"]["y"] + n["frame"]["height"] for n in paragraphs)
                self.assertGreater(foot, panel["frame"]["y"] + 0.7 * panel["frame"]["height"], "the prose runs down the page")
                # The prose fills the width it is given: no strip between its
                # measure and the edge of its column.
                for node in paragraphs:
                    ink = node["data"]["textLayout"]["width"]
                    self.assertGreater(ink, node["frame"]["width"] - 60, "the lines run to the column's edge")
                self.assertGreaterEqual(panel["frame"]["width"], 300)

    def test_a_memo_names_its_panel_at_compile(self):
        result = run_node(f"""
import {{compileDeck}} from '{RUNTIME}/author-deck.mjs';
const memo={{id:'m',type:'argument',form:'memo',commentary:'none',takeaway:false,why:'Reasoning about order reads as prose',
  settles:{{kind:'qualitative',what:'why fares follow the timetable'}},adds:null,title:'Fare reform should follow the new timetable, not lead it',
  paragraphs:['Cheaper fares are the obvious lever.']}};
let message='';
try {{ compileDeck({{deck:{{schema:'professional-slides.deck/v3',id:'d'}},pages:[memo]}}); }} catch (error) {{ message=String(error.message); }}
console.log(JSON.stringify({{message}}));
""")
        self.assertIn("panel", result["message"])
        self.assertIn("readable measure", result["message"])


class WholeWordHighlightTests(unittest.TestCase):
    def test_a_phrase_lights_whole_words_only(self):
        result = run_node(f"""
import {{accentRuns, hasPhrase}} from '{RUNTIME}/text-layout.mjs';
const lit=(text,phrases)=>(accentRuns(text,phrases,{{strict:false}})||[]).filter(r=>r.accent).map(r=>r.text);
let strict='';
try {{ accentRuns('Revenue peaked in FY22',['22']); }} catch (error) {{ strict=error.message; }}
console.log(JSON.stringify({{
  year: lit('Revenue in FY22 rose 22% by 2029',['22','29']),
  months: lit('It took 26 months, not 26 m',['26 m']),
  decimal: lit('3.7 times as fast and 3 points higher',['3']),
  thousands: lit('9,800 homes and 800 more',['800']),
  punctuation: lit('£38 million, 90% of it',['£38 million','90%']),
  hyphen: lit('the off-peak timetable',['peak']),
  inside: hasPhrase('fy22 journeys','22',{{ignoreCase:true}}),
  caseless: hasPhrase('Off-peak Journeys','journeys',{{ignoreCase:true}}),
  strict }}));
""")
        self.assertEqual(result["year"], ["22"], "the 22% is lit, not FY22 and not 2029")
        self.assertEqual(result["months"], ["26 m"], "the phrase lights where it stands alone, not in 'months'")
        self.assertEqual(result["decimal"], ["3"], "3 is not in 3.7")
        self.assertEqual(result["thousands"], ["800"], "800 is not in 9,800")
        self.assertEqual(result["punctuation"], ["£38 million", "90%"])
        self.assertEqual(result["hyphen"], ["peak"], "a hyphen ends a word")
        self.assertFalse(result["inside"])
        self.assertTrue(result["caseless"])
        self.assertIn("inside a longer word", result["strict"])

    def test_the_page_phrase_is_not_pushed_into_half_a_word(self):
        result = run_node(f"""
import {{composeSlide}} from '{RUNTIME}/compose.mjs';
const find=(items,pred)=>{{for(const it of items){{if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}}return null;}};
const page=composeSlide({{title:'T',layout:'text',highlight:['22'],points:['Journeys peaked in FY22 at 52 million.','They fell 22% in the first year of hybrid working.']}},0);
console.log(JSON.stringify(find(page.items,i=>i.component==='bullet-list').props.items));
""")
        self.assertIsInstance(result[0], str, "FY22 carries no highlight")
        self.assertEqual(result[1]["highlight"], ["22"])

    def test_compile_refuses_a_phrase_that_lights_half_a_word(self):
        result = run_node(f"""
import {{compileDeck}} from '{RUNTIME}/author-deck.mjs';
const years=['2019','2020','2021','2022','2023','2024','2025','2026'];
const page={{id:'p',type:'trend',form:'line',commentary:'below',takeaway:false,why:'The trend is the claim',
  settles:{{kind:'qualitative',what:'journeys by year'}},adds:'The points say why',title:'Journeys peaked in FY22 and have not recovered since',
  exhibit:{{categories:years,series:[{{name:'x',values:[1,2,3,4,5,6,7,8]}}],annotations:[{{category:'2022',text:'The peak year before hybrid working took hold'}}]}},
  points:['Journeys peaked in FY22 at 52 million.','They have recovered to 48 million since.'],highlight:['22','48 million']}};
let message='';
try {{ compileDeck({{deck:{{schema:'professional-slides.deck/v3',id:'d'}},pages:[page]}}); }} catch (error) {{ message=String(error.message); }}
console.log(JSON.stringify({{message}}));
""")
        self.assertIn('"22" occurs only inside a longer word', result["message"])
        self.assertIn("FY22", result["message"])


class CardsAtTheTopTests(unittest.TestCase):
    CARDS = {"type": "cards", "tone": "outline", "items": [
        {"icon": "clock", "title": "Off-peak timetable", "value": "+5.1m", "text": SENTENCES[0], "points": ["Owner: Priya Shah", "Starts: December 2027"]},
        {"icon": "bolt", "title": "Electrification", "value": "+3.8m", "text": SENTENCES[1], "points": ["Owner: Tom Hardcastle", "Starts: H2 2030"]},
        {"icon": "money", "title": "Fare reform", "value": "+1.6m", "text": SENTENCES[3], "points": ["Owner: Aisha Karim", "Starts: 2030"]}]}

    def test_cards_are_as_tall_as_their_copy_at_the_top(self):
        result = run_node(f"""
import {{createRegistry}} from '{RUNTIME}/registry.mjs';
const registry=createRegistry(), cards=registry.get('cards');
const props={json.dumps(self.CARDS)};
const frame={{x:60,y:152,width:1160,height:516}};
const nodes=cards.render({{id:'c',frame,props}}).nodes;
const surface=nodes.find(n=>n.role==='card-surface'), icon=nodes.find(n=>n.id.includes('icon'));
const copy=nodes.filter(n=>n.frame&&n.id.startsWith('c-card-0')&&n.role!=='card-surface');
const middle=registry.get('cards').render({{id:'m',frame,props:{{...props,valign:'middle'}}}}).nodes.find(n=>n.role==='card-surface');
console.log(JSON.stringify({{surface:surface.frame,iconTop:icon.frame.y,copyBottom:Math.max(...copy.map(n=>n.frame.y+n.frame.height)),
  ceiling:cards.measureCeiling({{frame,props}}),middleTop:middle.frame.y}}));
""")
        surface = result["surface"]
        self.assertEqual(surface["y"], 152, "the row starts at the top of its frame")
        self.assertLessEqual(result["iconTop"] - surface["y"], 20, "the icon sits under the box's top edge, not 80px down")
        self.assertLessEqual(surface["y"] + surface["height"] - result["copyBottom"], 24, "the box ends under its copy")
        self.assertLess(surface["height"], 516)
        self.assertAlmostEqual(result["ceiling"], surface["height"], delta=0.5, msg="the ceiling is the height drawn")
        self.assertGreater(result["middleTop"], 152, "valign middle still centres when asked")

    def test_a_full_width_card_row_gives_its_slack_to_what_follows(self):
        deck = plan([{"id": "c", "title": "Three levers add most of the growth in journeys by FY31",
                      "layout": "exhibit-full", "exhibit": self.CARDS,
                      "soWhat": "Over half the gain arrives before the wires are energised."}])
        slide = deck["slides"][0]
        cards = next(i for i in slide["componentInstances"] if i["component"] == "cards")
        surface = next(n for n in slide["nodes"] if n.get("role") == "card-surface")
        self.assertLess(surface["frame"]["y"] - cards["frame"]["y"], 1)
        self.assertLess(surface["frame"]["height"], 420, "the boxes hug their copy rather than running the page")


if __name__ == "__main__":
    unittest.main()
