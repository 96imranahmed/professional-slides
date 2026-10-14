"""Headline figures, source lines, source dates and rules through labels.

The BA retest's review found a headline figure on twelve pages that mostly
said the title's number again, source lines that sent every source to the
notes, a 2025 figure cited to an edition published before 2025 ended, dashed
event rules through value labels, a callout box over a rule's label, and a
chart heading that read "%, %". None of it was refused before the review.
"""

from __future__ import annotations

import unittest

from node_probe import run_node

RT = "./skills/professional-slides/runtime"


class HeadlineTests(unittest.TestCase):
    """A headline figure carries what the title and the chart do not, and no ten pages crowd it."""

    def test_a_headline_repeating_the_title_and_a_labelled_mark_is_refused(self):
        # pr01's case: the title, the hero figure and the bar's label all print 39.7m.
        result = run_node(f'''
import {{ dependencyFindings }} from '{RT}/gates/dependency_gates.mjs';
const insight = {{ id: "i1", finding: "Europe's premium passengers reached 39.7 million in 2025", shape: "series",
  measures: {{ pax: {{ unit: "passengers m", population: "Europe", periods: ["2024", "2025"], values: [37.1, 39.7] }} }} }};
const page = (kpi, title) => ({{ id: "p1", type: "numbers", form: "hero-number", title, evidence: ["i1"], settles: {{ measures: ["i1/pax"] }},
  kpi, exhibit: {{ type: "chart.bar", heading: "Premium passengers, m", series: [{{ measure: "i1/pax", name: "Europe" }}] }} }});
const doc = (p) => ({{ deck: {{}}, pages: [p] }});
const insights = new Map([["i1", insight]]);
const codes = (p) => dependencyFindings(doc(p), insights).filter((f) => f.code === "HEADLINE_REPEATS").map((f) => f.measured);
console.log(JSON.stringify({{
  repeated: codes(page({{ measure: "i1/pax@2025", format: "0.0m", label: "Premium passengers, 2025" }}, "Europe is the largest premium market: 39.7 million passengers in 2025")),
  ownFigure: codes(page({{ measure: "i1/pax@2024", format: "0.0m", label: "Premium passengers, 2024" }}, "Europe is the largest premium market: 39.7 million passengers in 2025")),
}}));
''')
        self.assertEqual(result["repeated"], [{"value": "39.7m", "repeats": "title and mark"}])
        self.assertEqual(result["ownFigure"], [])

    def test_more_than_two_headline_pages_in_ten_are_refused(self):
        result = run_node(f'''
import {{ headlineStructure, HEADLINE }} from '{RT}/deck-structure.mjs';
const page = (id, hero) => ({{ id, pageType: {{ type: "trend", form: hero ? "hero-number" : "line" }}, ...(hero ? {{ kpi: {{ value: "4%" }} }} : {{}}), exhibit: {{ type: "chart.line" }} }});
const deck = (heroes) => Array.from({{ length: 12 }}, (_, i) => page(`p${{i + 1}}`, heroes.includes(i + 1)));
const two = headlineStructure(deck([1, 6])), three = headlineStructure(deck([2, 3, 5]));
console.log(JSON.stringify({{ max: HEADLINE.perWindowMax, two: two.findings.length, twoValue: two.standings[0].value, three: three.findings.map((f) => f.measured) }}));
''')
        self.assertEqual(result["max"], 2)
        self.assertEqual(result["two"], 0)
        self.assertEqual(result["twoValue"], 2)
        self.assertEqual(result["three"][0]["ids"], ["p2", "p3", "p5"])
        self.assertGreater(result["three"][0]["windowsOver"], 0)


class SourceLineTests(unittest.TestCase):
    """Every form of a derived source line names the primary sources, dated."""

    def test_every_form_names_the_primaries_and_none_defers_them_all(self):
        result = run_node(f'''
import {{ citationForms }} from '{RT}/page-types.mjs';
const reg = {{ a: {{ name: "A annual report 2025", short: "A AR", date: "2026-02-27" }}, b: {{ name: "B results", short: "B" }},
  c: {{ name: "C survey", short: "C", date: "2025" }}, d: {{ name: "D release", short: "D" }} }};
console.log(JSON.stringify({{ forms: citationForms(["b", "c", "a", "d"], reg, {{ primary: ["a"] }}), bare: citationForms(["b", "d"], reg) }}));
''')
        forms = result["forms"]
        self.assertTrue(all("A AR, 27 Feb 2026" in form or "A annual report 2025, 27 Feb 2026" in form for form in forms), forms)
        self.assertEqual(forms[-1], "Sources: A AR, 27 Feb 2026; +3 more in the notes")
        self.assertFalse(any("listed in the notes" in form for form in forms))
        # With no primaries known (no measures name a source), the old floor stands: the count alone.
        self.assertEqual(result["bare"][-1], "Sources: 2 records, listed in the notes")

    def test_a_ranking_of_members_each_from_its_own_report_keeps_the_titles_source_and_fits(self):
        # fd01's case: ten groups' margins, each from its own results. Held as ten tied primaries, the line ran past every
        # footer (NOTE_HEAVY on fd01, fd04, fd05, o01); the title's own source is the one a reader must find on the page.
        result = run_node(f'''
import {{ primaryCitations }} from '{RT}/gates/dependency_gates.mjs';
import {{ citationForms }} from '{RT}/page-types.mjs';
import {{ measureProblems, measureRegistry }} from '{RT}/measures.mjs';
import {{ FOOTER_WORDS }} from '{RT}/page-template.mjs';
import {{ textWords }} from '{RT}/text-contract.mjs';
const members = Array.from({{ length: 10 }}, (_, i) => `Group ${{i}}`), keys = members.map((_, i) => `k${{i}}`);
const reg = Object.fromEntries(keys.map((key, i) => [key, {{ name: `Group ${{i}} annual report and accounts 2025`, short: `Group ${{i}} FY2025 results`, date: "2026-02" }}]));
const insight = (citeBy) => ({{ id: "i", cite: keys, measures: {{ margin: {{ unit: "%", population: "groups", period: "2025", members, values: members.map((_, i) => 5 + i), ...(citeBy ? {{ citeBy }} : {{}}) }} }} }});
const page = {{ exhibit: {{ type: "chart.bar", basis: {{ measures: ["i/margin"] }} }} }};
const titled = [{{ ref: "i/margin", label: "Group 3" }}];
const run = (citeBy) => {{ const measured = measureRegistry([insight(citeBy)]), primary = primaryCitations(page, measured, titled), forms = citationForms(keys, reg, {{ primary }});
  return {{ primary, last: forms.at(-1), words: textWords(forms.at(-1)) }}; }};
console.log(JSON.stringify({{ by: run(Object.fromEntries(members.map((m, i) => [m, [keys[i]]]))), plain: run(null), max: FOOTER_WORDS,
  problems: measureProblems(insight({{ "Group 3": ["k3"] }})), refused: measureProblems(insight({{ "Group 3": ["elsewhere"] }})).length }}));
''')
        self.assertEqual(result["by"]["primary"], ["k3"])
        self.assertEqual(result["by"]["last"], "Sources: Group 3 FY2025 results, Feb 2026; +9 more in the notes")
        self.assertLessEqual(result["by"]["words"], result["max"])
        # Without `citeBy` the measure's ten keys say nothing of which holds the title's number: no primary is taken, and
        # the first source stays named rather than the count alone.
        self.assertEqual(result["plain"]["primary"], [])
        self.assertEqual(result["plain"]["last"], "Sources: Group 0 FY2025 results, Feb 2026; +9 more in the notes")
        self.assertEqual(result["problems"], [])
        self.assertEqual(result["refused"], 1)

    def test_a_registry_date_must_be_a_date(self):
        result = run_node(f'''
import {{ registryProblems }} from '{RT}/sources-registry.mjs';
console.log(JSON.stringify({{ good: registryProblems({{ a: {{ name: "A", date: "2025-08" }} }}), bad: registryProblems({{ a: {{ name: "A", date: "August 2025" }} }}) }}));
''')
        self.assertEqual(result["good"], [])
        self.assertEqual(len(result["bad"]), 1)

    def test_a_measure_for_a_period_its_source_predates_is_refused(self):
        # pr01's case: a 2025 figure cited to the WATS edition published on 4 Aug 2025.
        result = run_node(f'''
import {{ sourceAgeProblems }} from '{RT}/sources-registry.mjs';
const reg = {{ wats24: {{ name: "IATA WATS 2024", date: "2025-08-04" }}, plan: {{ name: "Mandate", date: "2024-04" }}, undated: {{ name: "No date" }} }};
const m = (extra) => ({{ unit: "m", population: "Europe", periods: ["2024", "2025"], values: [37.1, 39.7], ...extra }});
const insights = [{{ id: "i", measures: {{ late: m({{ cite: ["wats24"] }}), target: m({{ cite: ["plan"], projected: true }}), open: m({{ cite: ["undated"] }}),
  fy: {{ unit: "%", population: "x", periods: ["FY25"], values: [1], cite: ["wats24"] }} }} }}];
console.log(JSON.stringify(sourceAgeProblems(reg, insights)));
''')
        self.assertEqual(result, [{"ref": "i/late", "period": "2025", "key": "wats24", "name": "IATA WATS 2024", "date": "4 Aug 2025"}])


class UnitHeadingTests(unittest.TestCase):
    def test_a_heading_ending_in_its_unit_keeps_it_once(self):
        result = run_node(f'''
import {{ headingClearOfUnit }} from '{RT}/bind.mjs';
console.log(JSON.stringify([headingClearOfUnit("Operating margin, 2025 or latest financial year, %", "%"), headingClearOfUnit("Revenue (GBP m)", "GBP m"), headingClearOfUnit("Share of seats, 2025", "%")]));
''')
        self.assertEqual(result, ["Operating margin, 2025 or latest financial year", "Revenue", "Share of seats, 2025"])


class LabelCrossingTests(unittest.TestCase):
    """An event rule breaks at a value label, and the scene gate sees a rule or a callout box over a label."""

    def test_the_scene_gate_reads_event_rules_and_callout_boxes(self):
        result = run_node(f'''
import {{ sceneCollisions }} from '{RT}/validate-overlap.mjs';
const style = {{ fontFamily: {{ value: "Arial" }}, fontSize: {{ value: 10 }}, align: "center", valign: "top" }};
const slide = {{ id: "s", nodes: [
  {{ type: "text", id: "label", role: "data-label", text: "207,000 flights", frame: {{ x: 600, y: 480, width: 120, height: 24 }}, style }},
  {{ type: "line", id: "rule", role: "chart-event-line", frame: {{ x: 659, y: 360, width: 0, height: 250 }}, data: {{ x1: 659, y1: 360, x2: 659, y2: 610 }} }},
  {{ type: "text", id: "flag", role: "chart-event-label", text: "Domestic band added", frame: {{ x: 180, y: 310, width: 150, height: 16 }}, style: {{ ...style, align: "left" }} }},
  {{ type: "rect", id: "box", role: "annotation-surface", frame: {{ x: 219, y: 270, width: 239, height: 46 }}, data: {{ annotationKey: "k" }} }},
  {{ type: "text", id: "note", role: "annotation-text", text: "Largest rise", frame: {{ x: 226, y: 277, width: 225, height: 16 }}, style: {{ ...style, align: "left" }}, data: {{ annotationKey: "k" }} }} ] }};
console.log(JSON.stringify(sceneCollisions(slide).filter((f) => ["TEXT_ON_LINE", "TEXT_ON_TEXT"].includes(f.code)).map((f) => [f.code, f.text, f.line ?? f.other])));
''')
        self.assertIn(["TEXT_ON_LINE", "label", "rule"], result)
        self.assertIn(["TEXT_ON_TEXT", "flag", "box"], result)
        self.assertNotIn(["TEXT_ON_TEXT", "note", "box"], result)

    def test_an_event_rule_breaks_at_the_value_labels_it_crosses(self):
        result = run_node(f'''
import {{ REGISTRY }} from '{RT}/registry.mjs';
const all = REGISTRY.get("chart.line").render({{ id: "c", frame: {{ x: 0, y: 0, width: 900, height: 420 }},
  props: {{ categories: ["2018", "2019", "2020", "2021", "2022"], series: [{{ name: "Flights", values: [480, 480, 207, 193, 384] }}], showDataLabels: true,
    events: [{{ at: "2020", label: "Covid grounding" }}] }} }}).nodes;
const rules = all.filter((n) => n.role === "chart-event-line");
const label = all.find((n) => n.role === "data-label" && /207/.test(n.text));
console.log(JSON.stringify({{ rules: rules.length, label: label ? label.frame : null, segments: rules.map((n) => [n.data.y1, n.data.y2]) }}));
''')
        self.assertIsNotNone(result["label"])
        top, bottom = result["label"]["y"], result["label"]["y"] + result["label"]["height"]
        self.assertGreaterEqual(result["rules"], 2, result)
        self.assertFalse(any(a < bottom and b > top for a, b in result["segments"]), result)


if __name__ == "__main__":
    unittest.main()
