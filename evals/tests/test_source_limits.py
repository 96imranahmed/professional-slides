"""A page cites the sources of the measures it shows, and what a source does not name is said once.

A review of a rendered deck filed one provenance finding across thirty-one
pages: the records named no publisher, so every page that printed one of
their numbers was individually deficient, and a page plotting one series of an
insight drawn from several sources listed every one of them. These hold the
repair. A measure may carry its own `cite`, and a page's citation is derived
from the measures it shows. A source the registry declares `missing` a
publisher, a date or a document, with the reason, is stated once for the deck
- on a page the runtime derives - and each page that cites it carries the
fact for the critic and the reviewer as a declared limit, while its own
source line still names the source. A revision's imported pages keep the
source lines they came with.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

LOG = '''
import { authorDeck, compileDeck, registryProblems, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { dependencyFindings, dependencyNotes, requiredCitations } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import { measureProblems, measureRegistry } from './skills/professional-slides/runtime/measures.mjs';
import { sourceLimitPages } from './skills/professional-slides/runtime/compose-deck.mjs';
const FY = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: ['sources/a.csv'] };
// One insight drawn from two sources: its revenue from the annual report alone, its staff from nowhere in particular.
const items = [{ ...graded, id: 'i1', shape: 'series', cite: ['report', 'ledger'], measures: {
  revenue: { unit: 'CHF bn', population: 'the company', periods: FY, values: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8], cite: ['report'] },
  orders: { unit: 'CHF bn', population: 'the company', periods: FY, values: [0.9, 1.0, 1.2, 1.3, 1.3, 1.5, 1.6, 1.9], cite: ['ledger'] },
  staff: { unit: 'employees', population: 'the company', periods: FY, values: [900, 950, 990, 1010, 1100, 1180, 1250, 1300] } } }];
const insights = new Map(items.map((i) => [i.id, i]));
const SOURCES = { report: { name: 'Northgate annual report 2026', status: 'audited' },
  ledger: { name: 'Order ledger supplied with the brief', missing: ['publisher', 'document'], reason: 'The client supplied the ledger as one file, and it names neither who compiled it nor the system it was drawn from' } };
const DECK = { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How has the company grown?' };
const trend = (id, names, more = {}) => ({ id, type: 'trend', form: 'line', commentary: 'so-what-bar', why: 'The movement over time is the claim, so the series is drawn', evidence: ['i1'],
  title: `The company grew in every year of the eight, page ${id}`, bar: 'The growth is steady, which is what the plan assumes it will stay for three more years',
  settles: { kind: 'rate', what: 'growth a year', measures: names.map((name) => `i1/${name}`) }, exhibit: { heading: 'Growth', series: names.map((name) => ({ measure: `i1/${name}`, name })), highlights: [{ category: 'FY26' }] }, ...more });
const compiled = (pages, deck = {}) => compileDeck({ deck: { ...DECK, ...deck }, sources: SOURCES, pages }, { insights, partial: true });
'''


class MeasureCitationTests(unittest.TestCase):
    def test_a_page_cites_the_sources_of_the_measures_it_shows(self):
        result = run_node(LOG + '''
const registry = measureRegistry(insights);
const pages = [trend('p1', ['revenue']), trend('p2', ['orders']), trend('p3', ['staff']), trend('p4', ['revenue', 'orders']),
  // A token in the title prints a measure the chart does not plot: the page shows both.
  trend('p5', ['revenue'], { title: 'Revenue grew while orders reached {{i1/orders@FY26 | 0.0}} billion, page p5' }),
  // A spine not laid out yet shows nothing: it is cited by the measures its claim is about.
  { ...trend('p6', ['orders']), exhibit: undefined }];
const c = compiled(pages);
console.log(JSON.stringify({ cites: Object.fromEntries([...registry].map(([ref, m]) => [ref, m.cite])), errors: c.compileErrors.filter((e) => !/^p6:/.test(e)),
  lines: Object.fromEntries(c.spec.slides.map((s) => [s.id, s.source])), claim: requiredCitations(pages[5], registry) }));
''')
        # The measure's own citation where it records one, otherwise its insight's.
        self.assertEqual(result["cites"], {"i1/revenue": ["report"], "i1/orders": ["ledger"], "i1/staff": ["report", "ledger"]})
        self.assertEqual(result["errors"], [])
        lines = result["lines"]
        self.assertEqual(lines["p1"], "Source: Northgate annual report 2026 (audited)")
        self.assertEqual(lines["p2"], "Source: Order ledger supplied with the brief")
        self.assertEqual(lines["p3"], "Sources: Northgate annual report 2026 (audited); Order ledger supplied with the brief")
        self.assertEqual(lines["p4"], lines["p3"])
        self.assertEqual(lines["p5"], lines["p3"])
        self.assertEqual(result["claim"], ["ledger"])

    def test_a_citation_that_leaves_out_a_shown_measures_source_is_refused_and_one_beyond_them_is_not_asked(self):
        result = run_node(LOG + '''
const codes = (page) => dependencyFindings({ deck: DECK, sources: SOURCES, pages: [page] }, insights).filter((f) => f.code === 'SOURCE_UNCITED').map((f) => [f.severity, f.repair]);
console.log(JSON.stringify({ short: codes(trend('p1', ['revenue', 'orders'], { source: ['report'] })), exact: codes(trend('p1', ['revenue'], { source: ['report'] })), wider: codes(trend('p1', ['revenue'], { source: ['report', 'ledger'] })),
  typed: codes(trend('p1', ['revenue'], { source: 'Source: company filings' })),
  problems: measureProblems({ ...items[0], measures: { ...items[0].measures, revenue: { ...items[0].measures.revenue, cite: 'report' } } }) }));
''')
        self.assertEqual([severity for severity, _ in result["short"]], ["blocker"])
        self.assertIn("`source` leaves out ledger, which the measures the page plots or its claim is about are cited to", result["short"][0][1])
        # A page that plots the revenue alone is not asked for the ledger its insight also draws on.
        self.assertEqual(result["exact"], [])
        self.assertEqual(result["wider"], [])
        self.assertEqual([severity for severity, _ in result["typed"]], ["blocker"])
        self.assertEqual(len(result["problems"]), 1)
        self.assertIn("`cite` on a measure is a list of keys of the pages file's `sources` registry", result["problems"][0])


class SourceLimitTests(unittest.TestCase):
    def test_the_registry_declares_what_a_source_does_not_name_with_the_reason(self):
        result = run_node(LOG + '''
const reason = 'The client supplied the ledger as one file and it names no compiler';
console.log(JSON.stringify({ ok: registryProblems(SOURCES), problems: registryProblems({ a: { name: 'A record', missing: ['publisher'] }, b: { name: 'A record', reason }, c: { name: 'A record', missing: ['author'], reason },
  d: { name: 'A record', missing: ['publisher'], reason, url: 'https://example.org/a' }, e: { name: 'A record', missing: ['date', 'date'], reason }, f: { name: 'A record', missing: ['date'], reason: 'unknown' }, g: { name: 'A record', missing: ['date'], reason, url: 'https://example.org/g' } }) }));
''')
        self.assertEqual(result["ok"], [])
        problems = result["problems"]
        self.assertEqual(len(problems), 6, problems)
        self.assertIn('source "a" declares it names no publisher: say why in `reason`', problems[0])
        self.assertIn('source "b": `reason` says why the record names no publisher, date or document, and goes with `missing`', problems[1])
        self.assertIn('source "c": `missing` lists what the record does not name - one or more of "publisher", "date", "document", each once', problems[2])
        # A record with a URL has a publisher: the declaration is not a way to leave a source unnamed.
        self.assertIn('source "d" declares it names no publisher and gives a `url`', problems[3])
        self.assertIn('source "e": `missing` lists', problems[4])
        self.assertIn('source "f" declares it names no date: say why in `reason`', problems[5])

    def test_the_limit_is_stated_once_for_the_deck_and_each_citing_page_carries_it_as_declared(self):
        result = run_node(LOG + '''
const pages = [trend('p1', ['revenue']), trend('p2', ['orders']), trend('p3', ['revenue', 'orders'])];
const c = compiled(pages);
const stated = Object.fromEntries(c.spec.slides.map((s) => [s.id, s.pageType.content.settles.stated?.limits ?? null]));
const derived = sourceLimitPages(c.spec);
const none = sourceLimitPages(compiled([trend('p1', ['revenue'])]).spec);
const result = await authorDeck({ deck: DECK, sources: SOURCES, pages }, { baseDir: '.', insights, fit: false, fill: false });
const page = result.deck.slides.find((s) => s.id === 'source-limits');
const cells = page.nodes.filter((n) => typeof n.text === 'string' && /^table/.test(n.role)).map((n) => n.text.replace(/\\s+/g, ' '));
console.log(JSON.stringify({ stated, lines: Object.fromEntries(c.spec.slides.map((s) => [s.id, s.source])), notes: dependencyNotes({ settles: { stated: c.spec.slides[1].pageType.content.settles.stated } }),
  derived: derived.map((p) => ({ id: p.id, title: p.title, columns: p.exhibit.columns.map((col) => col.label), rows: p.exhibit.rows })), none, cells,
  order: result.deck.slides.map((s) => s.sourceSlideId ?? s.id), about: [...result.blocking, ...result.advisories].filter((f) => String(f.id) === 'source-limits').map((f) => f.code) }));
''')
        limit = {"key": "ledger", "name": "Order ledger supplied with the brief", "missing": ["publisher", "document"],
                 "reason": "The client supplied the ledger as one file, and it names neither who compiled it nor the system it was drawn from"}
        # The pages that cite the ledger carry the declaration; the page that does not carries nothing.
        self.assertEqual(result["stated"], {"p1": None, "p2": [limit], "p3": [limit]})
        # No page's own citation is loosened: each still names its sources.
        self.assertEqual(result["lines"]["p2"], "Source: Order ledger supplied with the brief")
        self.assertEqual(result["lines"]["p3"], "Sources: Northgate annual report 2026 (audited); Order ledger supplied with the brief")
        # The critic and the reviewer read it on the page as a declared limit, with what to judge and what not to file.
        self.assertEqual(len(result["notes"]), 1)
        self.assertIn('cites "Order ledger supplied with the brief", which the deck declares names no publisher, no document', result["notes"][0])
        self.assertIn("a declared limit of the evidence, stated once for the deck", result["notes"][0])
        self.assertIn("do not file the missing publisher or document against this page", result["notes"][0])
        # One derived page states it for the deck: the source, what it does not name, why, and the pages that cite it.
        self.assertEqual(len(result["derived"]), 1)
        derived = result["derived"][0]
        self.assertEqual([derived["id"], derived["title"]], ["source-limits", "What the sources do not name"])
        self.assertEqual(derived["rows"], [["Order ledger supplied with the brief", "publisher, document", limit["reason"] + ".", "{{page:p2}}, {{page:p3}}"]])
        self.assertEqual(result["none"], [])
        # It is drawn behind the pages, with the page numbers written in, and no gate reads it as a page that argues.
        self.assertEqual(result["order"][-1], "source-limits")
        self.assertIn("Order ledger supplied with the brief", result["cells"])
        self.assertIn("publisher, document", result["cells"])
        self.assertEqual(result["cells"][-1], "2, 3")
        self.assertEqual(result["about"], [])


class RevisionTests(unittest.TestCase):
    def test_a_typed_source_line_is_kept_only_where_it_is_the_slides_own_over_the_slides_own_numbers(self):
        result = run_node(LOG + '''
import { applyRulesVersion } from './skills/professional-slides/runtime/weight.mjs';
import { stampKept } from './skills/professional-slides/runtime/revision.mjs';
const typed = trend('p1', ['revenue'], { source: 'Source: company filings, as the slide gave it', sourceSlide: 2 });
// The slide the page stands for, as an inventory holds it: its source line, and the chart whose values the page redraws.
const slide = (line, values = items[0].measures.revenue.values) => ({ index: 2, title: 'Growth', paragraphs: [{ text: line, role: 'source' }], tables: [], charts: [{ categories: FY, series: [{ name: 'revenue', values }] }] });
const judged = (inventorySlide, page = typed) => { const deck = { ...DECK, workflow: 'existing_deck_revision', rulesVersion: 6, inventory: 'x.inventory.json' };
  const c = compiled([page], deck); stampKept(c.spec, { slides: [inventorySlide] });
  return applyRulesVersion(dependencyFindings({ deck, sources: SOURCES, pages: [page] }, insights).filter((f) => f.code === 'SOURCE_UNCITED'), c.spec).map((f) => [f.severity, f.waived?.kept ?? null, c.spec.slides[0].pageType.kept ?? null]); };
const findings = (deck, page = typed) => dependencyFindings({ deck: { ...DECK, ...deck }, sources: SOURCES, pages: [page] }, insights).filter((f) => f.code === 'SOURCE_UNCITED').map((f) => [f.severity, f.repair]);
const revision = { workflow: 'existing_deck_revision', request: undefined };
const line = (deck) => compiled([typed], deck).spec.slides[0]?.source ?? null;
// A page the revision added itself has no slide's line to keep.
const { sourceSlide: _slide, ...added } = typed;
console.log(JSON.stringify({ fresh: findings({}), revised: findings(revision), added: findings(revision, added), line: line(revision),
  own: judged(slide('Source: company filings, as the slide gave it')), other: judged(slide('Source: the annual report')), moved: judged(slide('Source: company filings, as the slide gave it', [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.9])),
  // With no log - the usual revision - nothing reads the line at all.
  bare: dependencyFindings({ deck: { ...DECK, ...revision }, pages: [{ ...typed, evidence: undefined, settles: { kind: 'rate', what: 'growth a year' }, exhibit: { heading: 'Growth', unit: 'CHF bn', categories: FY, series: [{ name: 'revenue', values: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8] }] } }] }, null) }));
''')
        self.assertEqual([severity for severity, _ in result["fresh"]], ["blocker"])
        # The gate refuses a typed line whoever typed it: a `sourceSlide` on the page is no excuse of its own.
        self.assertEqual([severity for severity, _ in result["revised"]], ["blocker"])
        self.assertEqual([severity for severity, _ in result["added"]], ["blocker"])
        # The one decision on what a deck is held to excuses it where the compile found it to be the slide's own line, unchanged,
        # over numbers the slide already showed - and nowhere else.
        self.assertEqual(result["own"], [["advisory", "source", {"source": True}]])
        self.assertEqual(result["other"], [["blocker", None, None]])
        self.assertEqual(result["moved"], [["blocker", None, None]])
        self.assertEqual(result["line"], "Source: company filings, as the slide gave it")
        self.assertEqual(result["bare"], [])


if __name__ == "__main__":
    unittest.main()
