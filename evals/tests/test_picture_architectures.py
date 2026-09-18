"""The picture-led architectures, and the word floor that makes them usable.

The plan gate `PLAN_VISUAL_ANCHOR` says a page that enumerates named things
depicts each of them, and splits on what the thing is: an icon for a category,
a photograph for something depictable. The icon half needed no runtime - cards,
rows lists and icon-led point styles were all built. The photograph half had
nowhere to go: the rule could fire and the only shape that could answer it was a
comparison table with two pictures bolted on top. So the rule was unreachable in
exactly the half of the deck it was written for.

These tests hold the three shapes that answer it, and the two things that decide
whether an author can actually use them: what happens to a picture that has not
been cleared yet, and whether a page of photographs is asked for a table's worth
of words.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

BASE = "./skills/professional-slides"
PHOTO = "examples/assets/hills.jpg"


class PictureArchitectureTests(unittest.TestCase):
    def test_the_count_chooses_the_shape_and_the_shape_is_recorded(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{BASE}/runtime/compose.mjs';
const picture=(label)=>({{alt:label+' skyline',label,text:label+' carries the cheaper half of the decision by a clear margin.'}});
const page=(n)=>({{title:'A title that states the finding for this page',pictures:[...Array(n)].map((_,i)=>picture('City '+i)),soWhat:'One of them wins.'}});
const shapeOf=(slide)=>{{const recent=[];composeSlide(slide,0,'{BASE}',undefined,1,recent);return recent[0];}};
assert.equal(shapeOf(page(2)),'picture-pair');
assert.equal(shapeOf(page(3)),'picture-strip');
assert.equal(shapeOf(page(5)),'picture-strip');
assert.equal(shapeOf({{...page(1),points:['A point that runs to a sentence about the site.']}}),'picture-hero');
// The older `photo` page draws the same way and used to be recorded as `text`,
// so a deck's variety measure never saw that one of its pages was a picture.
assert.equal(shapeOf({{title:'A title that states the finding for this page',photo:{{path:'{PHOTO}',alt:'A site',credit:'examples/assets/source.json'}},points:['A point that runs to a sentence about the site.']}}),'picture-hero');
assert.throws(()=>composeSlide(page(6),0,'{BASE}'),/contact sheet/);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_the_pictures_take_the_height_the_cards_leave(self):
        # The other way round - a fixed band with the cards spread beneath it -
        # puts a void above the cards and another below them, and makes the row
        # of cards the largest frame on a page whose subject is the pictures.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{BASE}/runtime/compose.mjs';
const slide={{title:'Two cities, and the one the offer decides',pictures:[
  {{alt:'London',label:'London',text:'Rent at 62% of the New York figure.'}},
  {{alt:'New York',label:'New York',text:'Median pay 34% higher, and the tax that comes with it.'}}],
  soWhat:'Cost decides it below the threshold; earnings decide it above.'}};
const items=composeSlide(slide,0,'{BASE}').items;
const band=items.find(i=>i.id==='s01-pictures'), cards=items.find(i=>i.id==='s01-picture-cards');
assert.equal(band.size.height,'fill','the pictures take the leftover height');
assert.equal(cards.size.height,'hug','the cards hug what they say');
assert.equal(band.items.length,2);
assert.equal(cards.props.items.map(c=>c.title).join('|'),'London|New York');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_a_picture_with_no_file_composes_and_a_missing_file_does_not(self):
        # The difference is the whole sourcing contract. A picture nobody has
        # cleared yet is a plan that can still be laid out and gated, with the
        # gap visible on the page. A path that does not resolve is a typo, and a
        # typo that quietly became a grey box is how a deck goes out with a hole
        # in it.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{BASE}/runtime/compose.mjs';
const page=(pictures)=>({{title:'A title that states the finding for this page',pictures,soWhat:'It matters.'}});
const unsourced=composeSlide(page([{{alt:'Joker, still to source',label:'Joker',text:'The one with the box office.'}},
  {{alt:'Thanos, still to source',label:'Thanos',text:'The one with the franchise.'}}]),0,'{BASE}');
const frames=unsourced.items.find(i=>i.id==='s01-pictures').items;
assert.equal(frames[0].component,'image-frame');
assert.equal(frames[0].props.dataUri,undefined,'no file, no bitmap');
assert.equal(frames[0].props.alt,'Joker, still to source','the frame carries the line instead');
// A real file embeds, and carries its rights reference.
const sourced=composeSlide(page([{{path:'{PHOTO}',alt:'A site',credit:'examples/assets/source.json',label:'Block C',text:'Two access roads.'}},
  {{alt:'Block D',label:'Block D',text:'One access road.'}}]),0,'{BASE}');
const real=sourced.items.find(i=>i.id==='s01-pictures').items[0];
assert.match(real.props.dataUri,/^data:image\\/jpeg;base64,/);
assert.equal(real.props.authorization,'examples/assets/source.json');
assert.throws(()=>composeSlide(page([{{path:'examples/assets/nope.jpg',label:'A',text:'x'}},
  {{alt:'B',label:'B',text:'y'}}]),0,'{BASE}'),/No picture at .*no `path`/s);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_the_pictures_are_the_evidence_so_an_exhibit_is_refused(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{BASE}/runtime/compose.mjs';
const slide={{title:'A title that states the finding for this page',
  pictures:[{{alt:'A',label:'A',text:'x'}},{{alt:'B',label:'B',text:'y'}}],
  exhibit:{{type:'table',columns:['a','b'],rows:[['1','2']]}}}};
assert.throws(()=>composeSlide(slide,0,'{BASE}'),/page of its own/);
// And once any picture is labelled, they all are: the labels are one row of
// cards, and a card with no title is not a card.
const half={{title:'A title that states the finding for this page',
  pictures:[{{alt:'A',label:'A',text:'x'}},{{alt:'B'}}]}};
assert.throws(()=>composeSlide(half,0,'{BASE}'),/needs a `label`/);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_authored_picture_prose_survives_composition(self):
        # A field the composer can silently drop is a field the audit has to
        # know about, or a layout change turns an author's sentence into a
        # no-op that nothing reports.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{auditContent}} from '{BASE}/runtime/content-audit.mjs';
import {{composeSlide}} from '{BASE}/runtime/compose.mjs';
const slide={{title:'Two cities, and the one the offer decides',pictures:[
  {{alt:'London',label:'London',text:'Rent at 62% of the New York figure.'}},
  {{alt:'New York',label:'New York',text:'Median pay 34% higher.'}}]}};
const scene={{slides:[composeSceneish(composeSlide(slide,0,'{BASE}'))]}};
function composeSceneish(page){{
  const nodes=[{{type:'text',role:'action-title',text:page.title}}];
  const walk=(item)=>{{
    if(item?.props?.items) for(const card of item.props.items){{nodes.push({{type:'text',text:card.title}});if(card.text)nodes.push({{type:'text',text:card.text}});}}
    for(const child of item?.items||[]) walk(child);
  }};
  for(const item of page.items) walk(item);
  return {{nodes}};
}}
assert.equal(auditContent({{slides:[slide]}},scene).accepted,true);
const dropped=auditContent({{slides:[{{...slide,pictures:[{{...slide.pictures[0],text:'A sentence the composer never placed anywhere.'}},slide.pictures[1]]}}]}},scene);
assert.equal(dropped.accepted,false);
assert.equal(dropped.findings[0].code,'MISSING_AUTHORED_CONTENT');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


class PictureWordFloorTests(unittest.TestCase):
    """The floor follows the body the picture leaves, and stops at the cap.

    Without this a picture page fails THIN_PAGE every time: two labels, two
    lines and a so-what is forty words against a floor of ninety-five, and the
    only way to pass is to write the wall of text the picture replaced. With no
    cap it would go the other way, and a page could grow its photograph instead
    of making its argument.
    """

    def page(self, picture_fraction, roles="image"):
        frame = page_gates.content_frame({})
        area_side = (frame["width"] * frame["height"] * picture_fraction) ** 0.5
        nodes = [{
            "type": "image" if roles == "image" else "rect",
            "role": "image-frame",
            "frame": {"x": frame["x"], "y": frame["y"], "width": area_side, "height": area_side},
        }]
        return {"nodes": nodes, "contentFrame": frame}

    def test_a_page_with_no_picture_keeps_the_deck_floor(self):
        self.assertEqual(page_gates.picture_share({"nodes": []}), 0.0)

    def test_the_share_is_measured_and_capped(self):
        self.assertAlmostEqual(page_gates.picture_share(self.page(0.4)), 0.4, places=2)
        cap = page_gates.PICTURE["shareMax"]
        self.assertAlmostEqual(page_gates.picture_share(self.page(0.95)), cap, places=6)

    def test_an_uncleared_picture_counts_as_the_picture_it_will_be(self):
        # Otherwise the plan-time floor and the rendered floor disagree about
        # the same page, which is the disagreement THIN_PLAN exists to avoid.
        self.assertAlmostEqual(page_gates.picture_share(self.page(0.4, roles="rect")), 0.4, places=2)

    def test_the_thin_page_floor_falls_with_the_picture(self):
        floor = page_gates.WEIGHT["pageWords"]
        words = int(round(floor * 0.7))  # under the deck floor, over the picture floor
        slide = self.page(0.4)
        page_gates.gate_thin_page(1, {"nodes": []}, plain := [])
        self.assertTrue(plain, "a page with no picture and no words is still thin")
        findings = []
        original = page_gates.body_bands
        page_gates.body_bands = lambda _slide: (words, 0, 0)
        try:
            page_gates.gate_thin_page(1, slide, findings)
            self.assertEqual(findings, [], "a picture page is held to the body the picture left it")
            bare = []
            page_gates.gate_thin_page(1, {"nodes": [], "contentFrame": page_gates.content_frame({})}, bare)
            self.assertEqual([f["code"] for f in bare], ["THIN_PAGE"])
            self.assertEqual(bare[0]["threshold"], floor)
        finally:
            page_gates.body_bands = original


if __name__ == "__main__":
    unittest.main()
