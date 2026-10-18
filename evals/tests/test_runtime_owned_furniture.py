"""What the runtime derives or draws as furniture, the runtime fits.

A fifty-page run was refused twelve times for `NOTE_HEAVY` on footers the
runtime itself had written from the source registry, once because such a
footer ran past three lines, once because the contents style its own variation
drew could not hold seven sections, and its copy was measured for
fragmentation with the runtime's tracker strip counted as a text block.

The principle these tests hold: a citation written from registry keys is
fitted by the runtime - to the footer's lines and to the words the footer has
room for under the note bar - so it is not what refuses a page; `NOTE_HEAVY`
counts the footer as drawn, whoever wrote it, exactly as it did before the
runtime wrote citations; the contents page takes the style its sections fit,
and a style the author named that cannot is refused where the deck is
authored; the tracker is not the author's text. No bar on author-written content
moves: a typed footer is still counted and still held to its lines, a note
beside a derived citation is counted in full, and the fragmentation band is
read on pages measured as the reference pages were - chart headings, legends,
axis rows and data labels counted, since the band counted them.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest import mock

from node_probe import ROOT, run_node


LONG = "Northvale Rail annual report and accounts for the financial year FY{n}, operating statistics annex"

CITE = '''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring, sceneGateFindings, registryProblems } from './skills/professional-slides/runtime/author-deck.mjs';
import { pageBandsOf, NOTE_SHARE_MAX } from './skills/professional-slides/runtime/derive-content.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-types.pages.json', 'utf8'));
const chart = example.pages.find((p) => p.type === 'trend' && p.form === 'line');
// A page with a long body, whose footer has room for a long citation: the line limit is what binds on it.
const wordy = example.pages.find((p) => p.type === 'profiles' && p.form === 'people');
async function page(source, sources, { base = chart, note } = {}) {
  const { spec } = compileDeck({ deck: { ...example.deck }, ...(sources ? { sources } : {}), pages: [{ ...base, source, ...(note ? { note } : {}) }] });
  const composed = await composeForAuthoring(spec, dir);
  const slide = composed.deck?.slides.find((s) => s.id === base.id);
  const node = slide?.nodes.find((n) => n.role === 'source-text');
  const gates = composed.deck ? sceneGateFindings(composed.deck) : null;
  const bands = slide ? pageBandsOf(slide) : null;
  return { error: composed.error ?? null, pageErrors: composed.pageErrors ?? [], text: node?.text ?? null, lines: node?.data.textLayout.lines.length ?? null, derived: node?.data.derived === true,
    notes: slide?.notes ?? null, compiledSource: spec.slides[0].source, forms: spec.slides[0].sourceForms ?? null, bands, share: NOTE_SHARE_MAX,
    footer: bands?.footer, body: bands?.body, codes: gates ? [...gates.findings, ...gates.advisories].filter((f) => f.id === base.id).map((f) => f.code) : [] };
}
'''


def registry(n, short=False):
    return {f"s{i}": {"name": LONG.format(n=20 + i), "status": "company-reported", **({"short": f"Annual report FY{20 + i}"} if short else {})} for i in range(n)}


class DerivedCitationTests(unittest.TestCase):
    def probe(self, n, short=False, typed=None, wordy=False, note=None, sources=None):
        sources = registry(n, short) if sources is None else sources
        source = json.dumps(typed) if typed is not None else json.dumps(list(sources))
        options = "{ " + ("base: wordy, " if wordy else "") + (f"note: {json.dumps(note)}" if note else "") + " }"
        return run_node(CITE + f"console.log(JSON.stringify(await page({source}, {json.dumps(sources)}, {options})));")

    def assertWithinTheBar(self, result):
        self.assertNotIn("NOTE_HEAVY", result["codes"])
        self.assertLessEqual(result["footer"] / (result["footer"] + result["body"]), result["share"])

    def test_a_citation_that_fits_is_set_in_full(self):
        result = self.probe(2, wordy=True)
        self.assertEqual(result["pageErrors"], [])
        self.assertTrue(result["derived"])
        self.assertEqual(result["text"].replace("\n", " "), result["compiledSource"])
        self.assertIn("(company-reported)", result["text"])
        self.assertEqual(result["notes"], "")  # nothing was left out, so nothing is added to the notes
        self.assertWithinTheBar(result)

    def test_many_sources_are_fitted_and_never_refuse_the_page(self):
        # Eight long names run to five footer lines in full; before, the page
        # failed to compose ("Source exceeds three footer lines").
        result = self.probe(8, wordy=True)
        self.assertIsNone(result["error"])
        self.assertEqual(result["pageErrors"], [])
        self.assertLessEqual(result["lines"], 3)
        self.assertRegex(result["text"].replace("\n", " "), r"\+\d more in the notes$")
        self.assertTrue(result["text"].startswith("Sources: Northvale Rail annual report"))
        # Whatever the footer leaves out is kept whole in the speaker notes.
        for year in range(20, 28):
            self.assertIn(f"FY{year}", result["notes"])
        self.assertIn("(company-reported)", result["notes"])
        self.assertWithinTheBar(result)

    def test_a_footer_prints_short_names_where_they_keep_it_to_the_reference_footer(self):
        # Two sources in full fit the footer's lines and the note bar, and ran 30 words where strong pages set 13: their short
        # names, which still name both, are what the page prints; the full citation stays in the notes.
        result = self.probe(2, short=True, wordy=True)
        text = result["text"].replace("\n", " ")
        self.assertEqual(text, "Sources: Annual report FY20 (company-reported); Annual report FY21 (company-reported)")
        self.assertIn("operating statistics annex", result["notes"])

    def test_short_names_are_used_before_sources_are_counted(self):
        result = self.probe(8, short=True, wordy=True)
        text = result["text"].replace("\n", " ")
        self.assertLessEqual(result["lines"], 3)
        self.assertNotIn("more in the notes", text)
        for year in range(20, 28):
            self.assertIn(f"Annual report FY{year}", text)
        self.assertIn("operating statistics annex", result["notes"])  # the full names stay in the notes
        self.assertWithinTheBar(result)

    def test_the_forms_run_from_fullest_to_the_count_alone(self):
        result = self.probe(4, short=True)
        forms = result["forms"]
        self.assertEqual(forms[0], result["compiledSource"])
        named = [form.count("FY2") for form in forms]
        self.assertEqual(named, sorted(named, reverse=True), forms)  # each form names no more sources than the one before
        self.assertIn("Annual report FY20 (company-reported)", forms[1])  # short names, statuses kept
        self.assertNotIn("(company-reported)", forms[2])                 # then the statuses dropped
        self.assertEqual(forms[-1], "Sources: 4 records, listed in the notes")

    def test_the_footer_as_drawn_counts_and_a_derived_citation_is_fitted_under_the_bar(self):
        # A chart page's body is some fifty words, so its footer has room for
        # about twenty. Eight long registry names would put far more there: the
        # runtime sets the fullest form of its own line that has room, and the
        # words it draws are counted like any others.
        derived = self.probe(8)
        typed = self.probe(0, typed="Source: " + "; ".join(LONG.format(n=20 + i) for i in range(4)))
        self.assertEqual(derived["body"], typed["body"])
        self.assertTrue(derived["derived"])
        drawn = len(derived["text"].split())
        self.assertGreater(drawn, 0)
        self.assertGreaterEqual(derived["footer"], drawn)  # the derived line is in the count
        self.assertEqual(derived["bands"]["footer"], derived["footer"])
        self.assertWithinTheBar(derived)
        for year in range(20, 28):  # and nothing it left out is lost
            self.assertIn(f"FY{year}", derived["notes"])
        self.assertGreater(typed["footer"], 40)

    def test_the_fullest_form_with_room_is_the_one_drawn(self):
        # With short names the same page names as many sources as it has room
        # for before it counts the rest; every fuller form would pass the bar.
        result = self.probe(8, short=True)
        text = result["text"].replace("\n", " ")
        self.assertIn(text, result["forms"])
        self.assertIn("Annual report FY20", text)
        room = int(result["body"] * result["share"] / (1 - result["share"]) + 1e-9) - (result["footer"] - len(text.split()))
        self.assertLessEqual(len(text.split()), room)
        for fuller in result["forms"][:result["forms"].index(text)]:
            self.assertGreater(len(fuller.split()), room, fuller)
        self.assertWithinTheBar(result)

    def test_caveats_written_into_the_registry_are_not_drawn_past_the_bar(self):
        # Four caveats of fourteen to sixteen words as four registry names, and
        # six eight-word `short`s, each put fifty to seventy words in a footer
        # that was marked derived and not counted.
        caveats = ["Figures exclude the wholesale book and the two branches sold in March of this year",
                   "Liquidity is stated before the regulatory haircut which management estimates removes a fifth of liquid assets",
                   "Peer numbers are taken from unaudited half-year releases and restated to the calendar year by us",
                   "Every comparison on this page should therefore be read as indicative only and not as audited"]
        names = self.probe(0, sources={"report": {"name": "Northvale Rail annual report 2026"}, **{f"c{i}": {"name": text} for i, text in enumerate(caveats)}})
        words = " ".join(caveats).split()
        shorts = self.probe(0, sources={"report": {"name": "Northvale Rail annual report 2026"},
                                        **{f"s{i}": {"name": " ".join(words[i * 8:i * 8 + 8]), "short": " ".join(words[i * 8:i * 8 + 8])} for i in range(6)}})
        for result in (names, shorts):
            self.assertEqual(result["pageErrors"], [])
            self.assertWithinTheBar(result)
            self.assertLess(len(result["text"].split()), 30)
            self.assertNotIn("indicative only", result["text"])

    def test_a_note_beside_a_derived_citation_is_counted_and_not_shortened(self):
        # The runtime shortens only its own line: the citation falls back to
        # the count alone, and the author's note is drawn whole.
        note = "Note: " + " ".join(["figures exclude the wholesale book and the branches sold in March;"] * 3)
        result = self.probe(2, note=note)
        self.assertEqual(result["text"], "Sources: 2 records, listed in the notes")
        self.assertGreaterEqual(result["footer"], len(note.split()))

    def test_a_typed_citation_past_three_lines_is_still_refused(self):
        typed = self.probe(0, typed="Source: " + "; ".join(LONG.format(n=20 + i) for i in range(8)))
        self.assertTrue(any("Source exceeds three footer lines" in message for message in typed["pageErrors"] + [typed["error"] or ""]))

    def test_the_registry_takes_a_short_name_and_names_the_source_it_refuses(self):
        result = run_node(CITE + '''
console.log(JSON.stringify({ ok: registryProblems({ a: { name: 'Annual report', short: 'AR', url: 'https://example.org', status: 'audited' } }),
  bad: registryProblems({ reports: { name: 'Annual report', short: 7 } }), unknown: registryProblems({ reports: { name: 'Annual report', publisher: 'x' } }),
  written: (() => { try { compileDeck({ deck: { ...example.deck }, sources: { a: { name: 'A' } }, pages: [{ ...chart, source: ['a'], sourceForms: ['x'] }] }); return null; } catch (error) { return error.message; } })() }));
''')
        self.assertEqual(result["ok"], [])
        self.assertEqual(result["bad"], ['source "reports": `short` is text'])
        self.assertIn("{ name, short, url, status, retrieved, date }", result["unknown"][0])
        self.assertIn("written by the compiler", result["written"])

CONTENTS = '''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
import { variationChoices } from './skills/professional-slides/runtime/design-systems.mjs';
import { AGENDA_LIMITS } from './skills/professional-slides/runtime/panels.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-types.pages.json', 'utf8'));
const chart = example.pages.find((p) => p.type === 'trend' && p.form === 'line');
// A variation seed whose draw sets the contents page in columns.
const columnsSeed = Array.from({ length: 200 }, (_, i) => `seed-${i}`).find((seed) => variationChoices(seed).agendaStyle === 'columns');
async function deck(sections, deckKeys = {}, summary = 'What the part finds.') {
  const pages = Array.from({ length: sections }, (_, i) => [{ kind: 'section', id: `s${i}`, title: `Part ${i + 1}`, summary }, { ...chart, id: `p${i}` }]).flat();
  const { spec } = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined, ...deckKeys }, pages });
  const composed = await composeForAuthoring(spec, dir);
  const agenda = composed.deck?.slides.find((s) => s.id === 'agenda-1');
  return { pageErrors: (composed.pageErrors ?? []).filter((m) => /agenda/.test(m)), error: composed.error ?? null,
    style: agenda?.componentInstances.find((c) => c.component === 'agenda')?.variant ?? null,
    details: agenda ? agenda.nodes.filter((n) => n.role === 'agenda-detail').length : null, labels: agenda ? agenda.nodes.filter((n) => n.role === 'agenda-label').length : null };
}
'''


class ContentsPageTests(unittest.TestCase):
    def test_a_drawn_style_gives_way_to_the_one_the_sections_fit(self):
        result = run_node(CONTENTS + '''
console.log(JSON.stringify({ seed: columnsSeed, limits: AGENDA_LIMITS, six: await deck(AGENDA_LIMITS.columns.max, { variation: columnsSeed }), seven: await deck(AGENDA_LIMITS.columns.max + 1, { variation: columnsSeed }) }));
''')
        self.assertTrue(result["seed"], "no variation seed draws the columned contents page")
        self.assertEqual(result["six"]["style"], "columns")
        # Seven sections under the same draw: the list, not a refusal at composition.
        self.assertEqual(result["seven"]["style"], "list")
        self.assertEqual(result["seven"]["pageErrors"], [])
        self.assertEqual(result["seven"]["labels"], result["limits"]["columns"]["max"] + 1)

    def test_a_list_too_tall_with_its_summaries_drops_them_rather_than_failing(self):
        long = "A long summary of what this section covers, running to several lines so that ten of them cannot fit one page, and then some more words to be sure."
        result = run_node(CONTENTS + f'''
console.log(JSON.stringify({{ few: await deck(3, {{}}, {json.dumps(long)}), ten: await deck(10, {{}}, {json.dumps(long)}) }}));
''')
        self.assertEqual(result["few"]["details"], 3)
        self.assertEqual(result["ten"]["pageErrors"], [])
        self.assertEqual(result["ten"]["details"], 0)
        self.assertEqual(result["ten"]["labels"], 10)


def text(role, value, owner=None):
    return {"type": "text", "role": role, "text": value, "data": {"componentInstance": owner} if owner else {}}


if __name__ == "__main__":
    unittest.main()


class SharedShortNameTests(unittest.TestCase):
    def test_articles_of_one_publisher_are_named_once_in_the_short_forms(self):
        result = run_node('''
import { citationForms } from './skills/professional-slides/runtime/page-types.mjs';
const reg = { a: { name: 'Commercial Observer, first article (2026)', short: 'Commercial Observer' }, b: { name: 'Commercial Observer, second article (2026)', short: 'Commercial Observer' }, c: { name: 'Bisnow, an article', short: 'Bisnow' } };
console.log(JSON.stringify(citationForms(['a', 'b', 'c'], reg)));
''')
        self.assertIn("first article", result[0])        # the fullest form names each source
        self.assertIn("second article", result[0])
        self.assertEqual(result[1], "Sources: Commercial Observer; Bisnow")  # a short form says the publisher once
        self.assertEqual(result[-1], "Sources: 3 records, listed in the notes")
