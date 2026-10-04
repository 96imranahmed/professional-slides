"""A schedule's stages are set at reading size and sized to what they hold.

A five-stage roadmap with a sentence on each stage counted fifteen body words
- the sentences were never drawn - and its page was refused for a band of
nothing between the strip and the commentary; the timeline refused the same
stages outright, and a gantt milestone on the last period ran off the slide.
The same components produced the blocked pages of the benchmark before it.

A timeline or roadmap whose stages carry their date and their detail is now
set as stages (schedule-stages.mjs): date, label and detail, in columns or in
rows as its frame allows, from the top of the frame, with the commentary
against it. Nothing is stretched: a page with too little on it is still short
at its foot. These tests hold the words, the arrangement and the fit, and one
opt-in test renders the pages and gates them on their pixels.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_RENDERER, NODE, ROOT, requires_python_package, run_node

SKILL = ROOT / "skills" / "professional-slides"
PYTHON = os.environ.get("RUNTIME_PYTHON") or sys.executable

STAGES = [
    ["Mar 2027", "Crews recruited", "Thirty-six drivers and guards are in post after three training intakes, enough to run a train every half hour."],
    ["Jun 2027", "Timetable bid lodged", "The bid asks for two unused freight paths between the peaks, so no capacity study is needed."],
    ["Nov 2027", "Depot extension opens", "Twelve new sidings hold the added units overnight, which keeps them off the running lines."],
    ["Dec 2027", "Dales service starts", "A half-hourly off-peak service runs from Leeds to Skipton, with a later last train home."],
    ["May 2028", "Valley service starts", "Halifax and Huddersfield move to a half-hourly pattern once the Halifax sidings are extended."],
    ["2029", "Power upgrade delivered", "The grid connection for the Eastern line is energised, the one date outside the operator's control."],
    ["H2 2030", "Electric trains run", "Fourteen electric trains replace the diesel fleet between Leeds and Hull and free eleven units."],
]
PICK = {3: [0, 3, 6], 5: [0, 1, 3, 4, 6], 7: [0, 1, 2, 3, 4, 5, 6]}
POINTS = [
    {"lead": "The first three dates are the operator's own", "text": "Recruiting crews, lodging the bid and opening the depot depend on nobody else, and each has a named owner who reports to the programme board every month. A slip in any one of them moves the December 2027 start by a whole timetable round, which is six months."},
    {"lead": "The power upgrade is the exposed date", "text": "The grid connection is delivered by the network operator, not by the railway, and it is the only milestone the plan cannot recover by working faster. The bi-mode order is held ready as the fallback if it slips past 2029."},
    {"lead": "What each date is worth", "text": "The two timetable changes add 5.1 million journeys a year between them, and the electric trains a further 3.8 million. A year's delay to the wires therefore costs a third of the plan, and a missed bid costs under a tenth."},
]


def slide(kind, count, layout):
    items = [{"label": label, "date": date, "text": text} for date, label, text in (STAGES[i] for i in PICK[count])]
    page = {"id": f"{kind}-{count}-{layout}", "title": "The Dales service starts in December 2027 and the wires follow", "layout": f"exhibit-{layout}",
            "exhibit": {"type": kind, "items": items}, "source": "Source: illustrative data for a fictional operator"}
    if layout == "full":
        page["soWhat"] = "A missed bid costs six months; a late power upgrade costs a third of the plan."
    else:
        page["points"] = POINTS
    return page


COMPOSE = '''
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { sceneGateFindings } from './skills/professional-slides/runtime/author-deck.mjs';
import { stagesLayout } from './skills/professional-slides/runtime/schedule-stages.mjs';
function measure(page) {
  const spec = { schema: 'professional-slides.deck/v3', id: 'sched', design: 'consulting', slides: [page] };
  let deck;
  try { deck = composeAll(spec, '.').deck; } catch (error) { return { error: error.message }; }
  const scene = deck.slides.find((s) => s.id === page.id), prefix = `${page.id}:${page.id}`;
  const own = scene.nodes.filter((n) => n.data?.componentInstance === `${prefix}-exhibit` && n.frame);
  const frame = scene.componentInstances.find((c) => c.id === `${page.id}-exhibit`).frame;
  const after = scene.componentInstances.find((c) => [`${page.id}-below`, `${page.id}-sowhat`].includes(c.id))?.frame ?? null;
  const gates = sceneGateFindings(deck, undefined, spec);
  const voids = [...gates.findings, ...gates.advisories].filter((f) => /VOID|DEAD_BAND/.test(f.code)).map((f) => ({ code: f.code, severity: f.severity, kind: f.measured?.kind, band: f.measured?.band }));
  const roles = own.filter((n) => n.type === 'text').reduce((m, n) => ({ ...m, [n.role]: (m[n.role] || 0) + 1 }), {});
  const texts = own.filter((n) => /-text$/.test(n.role));
  return { words: scene.planBodyWords, roles, frame, inkBottom: Math.max(...own.map((n) => n.frame.y + (n.frame.height || 0))), after,
    rows: new Set(texts.map((n) => Math.round(n.frame.y))).size, columns: new Set(texts.map((n) => Math.round(n.frame.x))).size, voids,
    inside: own.every((n) => n.frame.x >= frame.x - 1 && n.frame.x + (n.frame.width || 0) <= frame.x + frame.width + 1 && n.frame.y + (n.frame.height || 0) <= frame.y + frame.height + 1) };
}
'''


class StageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pages = [slide(kind, count, layout) for kind in ("roadmap", "timeline") for count in (3, 5, 7) for layout in ("top", "left", "full")]
        cls.pages = run_node(COMPOSE + f"console.log(JSON.stringify(Object.fromEntries({json.dumps(pages)}.map((page) => [page.id, measure(page)]))));")

    def test_every_stage_is_drawn_with_its_date_label_and_detail(self):
        for name, page in self.pages.items():
            kind, count = name.split("-")[0], int(name.split("-")[1])
            with self.subTest(page=name):
                self.assertNotIn("error", page, page.get("error"))
                for part in ("when", "label", "text"):
                    self.assertEqual(page["roles"].get(f"{kind}-{part}"), count, f"{part} of each stage")
                self.assertTrue(page["inside"], "a stage runs outside the schedule's frame")

    def test_the_stage_text_counts_as_the_pages_words(self):
        # Five stages of sixteen words each used to count fifteen words in all.
        stage_words = {count: sum(len(" ".join(STAGES[i]).split()) for i in PICK[count]) for count in PICK}
        bar = len("A missed bid costs six months; a late power upgrade costs a third of the plan.".split())
        for kind in ("roadmap", "timeline"):
            for count in (3, 5, 7):
                with self.subTest(kind=kind, stages=count):
                    self.assertEqual(self.pages[f"{kind}-{count}-full"]["words"], stage_words[count] + bar)

    def test_no_band_opens_between_the_schedule_and_what_follows(self):
        # The stages reach the foot of the frame they were given, and the
        # commentary or the closing bar starts a gap below them.
        for name, page in self.pages.items():
            if page["after"] is None:
                continue
            with self.subTest(page=name):
                self.assertLessEqual(page["frame"]["y"] + page["frame"]["height"] - page["inkBottom"], 10)
                self.assertLessEqual(page["after"]["y"] - (page["frame"]["y"] + page["frame"]["height"]), 17)
                self.assertNotIn("internal", [v["kind"] for v in page["voids"]])

    def test_a_page_with_stages_and_commentary_carries_no_blocking_void(self):
        for kind in ("roadmap", "timeline"):
            for count in (5, 7):
                for layout in ("top", "left"):
                    with self.subTest(page=f"{kind}-{count}-{layout}"):
                        self.assertEqual([v for v in self.pages[f"{kind}-{count}-{layout}"]["voids"] if v["severity"] == "blocker"], [])
            # Seven stages hold a page on their own, over a closing bar.
            self.assertEqual([v for v in self.pages[f"{kind}-7-full"]["voids"] if v["severity"] == "blocker"], [])

    def test_nothing_is_stretched_to_cover_a_thin_page(self):
        # Three stages and a closing line are a third of a page: the group
        # stays at its size at the top and the page is reported short at its
        # foot, not padded out.
        for kind in ("roadmap", "timeline"):
            page = self.pages[f"{kind}-3-full"]
            self.assertLess(page["frame"]["height"], 300)
            self.assertEqual([(v["kind"], v["severity"]) for v in page["voids"]], [("dead", "blocker")])

    def test_the_frame_decides_between_columns_and_rows(self):
        # Beside the commentary the frame is tall: rows. Over three columns of
        # points, seven stages have no height for rows: columns.
        for kind in ("roadmap", "timeline"):
            with self.subTest(kind=kind):
                self.assertEqual((self.pages[f"{kind}-7-left"]["rows"], self.pages[f"{kind}-7-left"]["columns"]), (7, 1))
                self.assertEqual((self.pages[f"{kind}-7-top"]["rows"], self.pages[f"{kind}-7-top"]["columns"]), (1, 7))
                self.assertEqual(self.pages[f"{kind}-5-left"]["rows"], 5)

    def test_orientation_can_be_named_and_the_choice_is_the_one_drawn(self):
        items = [{"label": label, "date": date, "text": text} for date, label, text in (STAGES[i] for i in PICK[5])]
        result = run_node(COMPOSE + f'''
const items = {json.dumps(items)};
const layout = (frame, props, roadmap) => {{ try {{ const L = stagesLayout(frame, props, {{ roadmap }}); return {{ orientation: L.orientation, stacked: L.stacked ?? false, natural: L.natural, ceiling: L.ceiling, height: L.height }}; }} catch (error) {{ return {{ error: error.message }}; }} }};
const wide = {{ x: 0, y: 0, width: 1160 }};
console.log(JSON.stringify({{
  unbounded: layout(wide, {{ items }}, false), shallow: layout({{ ...wide, height: 250 }}, {{ items }}, false), tall: layout({{ ...wide, height: 528 }}, {{ items }}, false),
  roomy: layout({{ ...wide, height: 528 }}, {{ items }}, true), tight: layout({{ ...wide, height: 300 }}, {{ items }}, true),
  across: layout({{ ...wide, height: 528 }}, {{ items, orientation: 'across' }}, false), down: layout({{ ...wide, height: 528 }}, {{ items, orientation: 'down' }}, false),
  wrong: layout(wide, {{ items, orientation: 'sideways' }}, false), unlabelled: layout(wide, {{ items: [{{ date: '2027' }}] }}, false) }}));
''')
        self.assertEqual(result["unbounded"]["orientation"], "across")  # a height not yet known: the columns
        self.assertEqual(result["shallow"]["orientation"], "across")    # no height for rows
        self.assertEqual(result["tall"]["orientation"], "down")
        self.assertEqual(result["across"]["orientation"], "across")
        self.assertEqual(result["down"]["orientation"], "down")
        # A roadmap's rows take the period under the label where the frame has the height for it.
        self.assertEqual((result["roomy"]["orientation"], result["roomy"]["stacked"]), ("down", True))
        self.assertEqual((result["tight"]["orientation"], result["tight"]["stacked"]), ("down", False))
        for name in ("unbounded", "shallow", "tall", "roomy", "tight"):
            self.assertLessEqual(result[name]["natural"], result[name]["height"])
            self.assertLessEqual(result[name]["height"], result[name]["ceiling"])
        self.assertIn('"across"', result["wrong"]["error"])
        self.assertIn("requires a label", result["unlabelled"]["error"])

    def test_a_strip_of_bare_labels_is_still_a_strip(self):
        result = run_node(COMPOSE + '''
const strip = (type) => measure({ id: 's', title: 'Four phases take the plan from diagnosis to scale by 2027', layout: 'exhibit-top', exhibit: { type, items: ['Diagnose', 'Design', 'Pilot', 'Scale'], active: 1 },
  points: ['The first two phases are complete and the pilot runs in two markets for a quarter before the decision to scale is taken.'] });
const objects = measure({ id: 's', title: 'Four phases take the plan from diagnosis to scale by 2027', layout: 'exhibit-top', exhibit: { type: 'timeline', items: [{ label: 'Diagnose' }, { label: 'Design' }, { label: 'Pilot' }, { label: 'Scale' }] },
  points: ['The first two phases are complete and the pilot runs in two markets for a quarter before the decision to scale is taken.'] });
console.log(JSON.stringify({ roadmap: strip('roadmap').roles, timeline: strip('timeline').roles, objects: objects.error ?? objects.roles }));
''')
        self.assertEqual(result["roadmap"], {"process-number": 4, "process-label": 4})
        self.assertEqual(result["timeline"], {"process-number": 4, "process-label": 4})
        self.assertEqual(result["objects"], {"process-number": 4, "process-label": 4})  # a label written as { label } is a label


class GanttMilestoneTests(unittest.TestCase):
    def test_a_milestone_on_any_period_keeps_its_label_on_the_page(self):
        result = run_node('''
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const periods = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
const out = [];
for (let at = 0; at <= periods.length; at += 1) {
  const page = { id: 'g', title: 'First delivery is seven years late and now expected in 2027', layout: 'exhibit-full',
    exhibit: { type: 'gantt', periods, groups: [{ name: 'Fleet', rows: [{ label: 'First delivery expected', from: 0, to: 1, text: 'Report' }, { label: 'Delay to first delivery', from: 0, to: Math.max(1, at), text: 'Seven years', milestones: [{ at, label: 'Delivery 2027' }] }] }] } };
  try {
    const slide = composeAll({ schema: 'professional-slides.deck/v3', id: 'g', design: 'consulting', slides: [page] }, '.').deck.slides.find((s) => s.id === 'g');
    const label = slide.nodes.find((n) => n.role === 'gantt-milestone-label'), grid = slide.componentInstances.find((c) => c.id === 'g-exhibit').frame;
    out.push({ at, right: label.frame.x + label.frame.width, left: label.frame.x, gridRight: grid.x + grid.width, width: label.frame.width, text: label.data.textLayout.width });
  } catch (error) { out.push({ at, error: error.message }); }
}
console.log(JSON.stringify({ out }));
''')["out"]
        self.assertEqual(len(result), 11)
        for case in result:
            with self.subTest(at=case["at"]):
                self.assertNotIn("error", case, case.get("error"))
                self.assertLessEqual(case["right"], case["gridRight"] + 0.5)
                self.assertLessEqual(case["right"], 1280)
                self.assertGreaterEqual(case["width"] + 0.5, case["text"])  # and the box still holds its words


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_RENDERER, "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class RenderedScheduleTests(unittest.TestCase):
    def test_schedule_pages_are_authored_built_and_pass_the_gates_on_their_pixels(self):
        forms = json.loads((SKILL / "examples" / "page-forms.pages.json").read_text(encoding="utf-8"))
        worked = json.loads((SKILL / "examples" / "page-types.pages.json").read_text(encoding="utf-8"))
        schedule = [page for page in forms["pages"] if page["type"] == "schedule"]
        self.assertEqual(sorted(page["form"] for page in schedule), ["roadmap", "timeline"])
        summary = next(page for page in worked["pages"] if page.get("type") == "summary")
        deck = {key: value for key, value in worked["deck"].items() if key != "workflow"}
        deck["id"] = "schedules"
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "work"
            shutil.copytree(SKILL / "examples" / "assets", work / "assets")
            pages = work / "schedules.pages.json"
            pages.write_text(json.dumps({"deck": deck, "pages": [summary, *schedule]}), encoding="utf-8")
            env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": str(Path(tmp) / "home"), "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
            authored = subprocess.run([NODE, str(SKILL / "runtime" / "author-deck.mjs"), str(pages)], cwd=ROOT, capture_output=True, text=True, env=env, timeout=300)
            self.assertEqual(authored.returncode, 0, authored.stderr[-1500:])
            out = Path(tmp) / "out"
            built = subprocess.run([NODE, str(SKILL / "runtime" / "build-deck.mjs"), str(work / "schedules.deck.json"), str(out), "--no-fetch", "--python", PYTHON],
                                   cwd=ROOT, capture_output=True, text=True, env=env, timeout=600)
            self.assertEqual(built.returncode, 0, (built.stderr + built.stdout)[-1500:])
            result = json.loads((out / "build-result.json").read_text())
            self.assertEqual(result["status"], "built")
            gates = json.loads((out / "gates.json").read_text())
            self.assertFalse(gates.get("pixelGatesSkipped"), "the page gates measured the renders")
            voids = [f for f in gates["findings"] if any(word in f["code"] for word in ("VOID", "DEAD_BAND"))]
            self.assertEqual(voids, [])
            self.assertEqual(len(sorted((out / "rendered").glob("slide-*.png"))), 4)  # cover, summary, timeline, roadmap


if __name__ == "__main__":
    unittest.main()
