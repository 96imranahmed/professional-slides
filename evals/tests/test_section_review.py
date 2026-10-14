"""Review each section as it is written; read the whole deck once for what needs it.

On the BA retest (ba4) the deck was reviewed once, at the end: 102 pages in 12
packets, 19 minutes, the longest packet 18.5, and 171 findings, 15 of them
blockers. Replayed through the stage map, 161 of the 171 - every blocker - were
for a stage before the final review: page craft a reader of one section could
have seen as soon as it was drawn (66), and defects a renderer default, a page
gate or the spine already owns. So a section is reviewed beside the other
sections' writing, bound to the drawings it read, with closed fixes; the final
review reads only the pages a section review does not stand for; packets are
split by what they cost to read; and every final-review finding an earlier
stage could have caught is logged as an escape.
"""
import json
import os
import subprocess
import tempfile
import unittest

from node_probe import run_node

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = './skills/professional-slides/runtime'


class StageMapTests(unittest.TestCase):
    def test_every_reviewer_code_has_its_earliest_stage(self):
        """A code with no stage would leave its escapes uncounted: every code the reviewer or the review class names has one."""
        result = run_node(f'''
import {{ CODES, CODES_AT_SPINE }} from '{KIT}/reviewer.mjs';
import {{ GATE_CLASSES }} from '{KIT}/gates/gate_classes.mjs';
import {{ REVIEW_STAGES, STAGES }} from '{KIT}/review-stages.mjs';
const codes = [...new Set([...Object.keys(CODES), ...Object.entries(GATE_CLASSES).filter(([, c]) => c === 'R').map(([code]) => code)])];
console.log(JSON.stringify({{ missing: codes.filter((c) => !REVIEW_STAGES[c]), badStage: Object.entries(REVIEW_STAGES).filter(([, s]) => !STAGES.includes(s.stage) || !(s.why || '').trim()).map(([c]) => c),
  spineElsewhere: CODES_AT_SPINE.filter((c) => REVIEW_STAGES[c].stage !== 'spine'), stages: STAGES }}));
''')
        self.assertEqual(result['missing'], [])
        self.assertEqual(result['badStage'], [])
        # The spine codes are the ones the storyline critic decides (reviewer.mjs CODES_AT_SPINE): one classification, not two.
        self.assertEqual(result['spineElsewhere'], [])
        self.assertEqual(result['stages'], ['renderer', 'page-gate', 'spine', 'section-review', 'final-review'])

    def test_escapes_are_the_findings_an_earlier_stage_could_have_caught(self):
        """ba4 filed a heat table shading both ways on one page as INCONSISTENT_ENCODING: on one page it was its section reader's to see."""
        result = run_node(f'''
import {{ escapesOf, stageOf }} from '{KIT}/review-stages.mjs';
const f = (id, code, scope, dimension, slides, severity = 'major') => ({{ id, code, scope, dimension, slides, severity }});
const findings = [f('F1', 'UNANNOTATED_PLOT', 'deck', 'chart', ['p1', 'p7']), f('F2', 'INCONSISTENT_ENCODING', 'page', 'table', ['p3']),
  f('F3', 'INCONSISTENT_ENCODING', 'deck', 'consistency', ['p2', 'p9']), f('F4', 'COLUMN_VOID', 'page', 'layout', ['p4'], 'minor'),
  f('F5', 'OPENING_DRIFT', 'deck', 'rhythm', ['p1', 'p2']), f('F6', 'UNEQUAL_TIME_SPACING', 'page', 'chart', ['p5'], 'blocker'), f('F7', 'EDITORIAL', 'page', 'text', ['p6'], 'none')];
const e = escapesOf(findings);
console.log(JSON.stringify({{ count: e.count, of: e.of, byStage: e.byStage, ids: e.items.map((i) => [i.id, i.stage, i.by]), f3: stageOf(findings[2]), f5: stageOf(findings[4]) }}));
''')
        self.assertEqual(result['count'], 4)
        self.assertEqual(result['of'], 6)
        self.assertEqual(result['ids'], [['F1', 'section-review', 'code'], ['F2', 'section-review', 'page'], ['F4', 'page-gate', 'class'], ['F6', 'renderer', 'code']])
        self.assertEqual(result['byStage'], {'renderer': 1, 'page-gate': 1, 'spine': 0, 'section-review': 2})
        self.assertEqual(result['f3'], {'stage': 'final-review', 'by': 'code'})
        self.assertEqual(result['f5'], {'stage': 'final-review', 'by': 'dimension'})

    def test_escapes_are_logged_by_code_and_page_and_never_counted_as_runs(self):
        """The run log is the evidence for which first loop to deepen next: an escape per page, beside the runs it does not inflate."""
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ escapesOf }} from '{KIT}/review-stages.mjs';
import {{ logEscapes, readRunLog, runCost }} from '{KIT}/run-log.mjs';
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'escapes-')), 'deck.author-log.jsonl');
fs.writeFileSync(file, JSON.stringify({{ at: 'x', run: 1, v: 2, mode: 'check', ok: true, findings: [] }}) + '\\n');
logEscapes(file, escapesOf([{{ id: 'F1', code: 'UNANNOTATED_PLOT', scope: 'deck', dimension: 'chart', slides: ['p1', 'p2'], severity: 'major' }}]).items, {{ pass: 1 }});
const lines = fs.readFileSync(file, 'utf8').trim().split('\\n').map((l) => JSON.parse(l));
console.log(JSON.stringify({{ logged: lines[1].escapes, runs: readRunLog(file).length, cost: runCost(readRunLog(file)).runs }}));
''')
        self.assertEqual(result['logged'], [{'code': 'UNANNOTATED_PLOT', 'page': 'p1', 'stage': 'section-review', 'severity': 'major'},
                                            {'code': 'UNANNOTATED_PLOT', 'page': 'p2', 'stage': 'section-review', 'severity': 'major'}])
        self.assertEqual(result['runs'], 1)
        self.assertEqual(result['cost'], 1)

    def test_packets_are_cut_by_reading_cost_not_page_count(self):
        """ba4's packets ran 14 to 44 cost units and the two dearest held the review to 18.5 minutes: no packet now costs more than the target, and no page or two is left alone."""
        result = run_node(f'''
import {{ costSections, PACKET_COST }} from '{KIT}/review-stages.mjs';
const page = (id, cost, opens = false) => ({{ id, title: id, opens, cost }});
const pages = [page('c', 1), ...Array.from({{ length: 30 }}, (_, i) => page(`a${{i}}`, 3, i === 0)), page('b0', 1, true), page('b1', 1), ...Array.from({{ length: 6 }}, (_, i) => page(`d${{i}}`, 1.5, i === 0))];
const parts = costSections(pages, {{ key: 'slides' }});
console.log(JSON.stringify({{ target: PACKET_COST, costs: parts.map((p) => p.cost), sizes: parts.map((p) => p.slides.length), covered: parts.flatMap((p) => p.slides).length, total: pages.length }}));
''')
        self.assertEqual(result['covered'], result['total'])
        self.assertTrue(all(c <= result['target'] for c in result['costs']), result['costs'])
        # The 90-unit section is cut into even runs, and the two-page section is folded into a neighbour.
        self.assertGreaterEqual(len(result['costs']), 5)
        self.assertTrue(min(result['sizes']) >= 3, result['sizes'])


FIXTURE = f'''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as R from '{KIT}/reviewer.mjs';
import * as C from '{KIT}/page-check.mjs';
const IDS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'];
const slide = (id, text = 'Title') => ({{ id, nodes: [{{ type: 'text', role: 'action-title', text }}, {{ type: 'text', role: 'page-number', text: '3' }}], componentInstances: [] }});
const checks = () => Object.fromEntries(R.PAGE_DIMENSIONS.map((d) => [d, `checked ${{d}} on the page`]));
const prov = () => ({{ backend: 'subagent', model: 'fixture-model', promptHash: 'd'.repeat(64) }});
const finding = (o) => ({{ scope: 'page', dimension: 'chart', code: 'UNANNOTATED_PLOT', severity: 'major', reason: 'The gap the title states is not marked on the chart.',
  repair: 'Annotate the gap between the two bars with its value.', touches: ['copy'], checkable: null, ...o }});
const completeness = (findings) => R.PAGE_DIMENSIONS.map((d) => findings.some((f) => f.dimension === d) ? {{ dimension: d, result: 'findings', note: 'Filed above, with its fix.' }} : {{ dimension: d, result: 'clean', note: `Checked ${{d}} on each page of the section; nothing to raise.` }});
const out = await fs.mkdtemp(path.join(os.tmpdir(), 'section-review-'));
const pages = {{ p01: {{ id: 'p01', title: 'One', annotations: [] }}, p02: {{ id: 'p02', title: 'Two', points: ['a'] }}, p03: {{ id: 'p03', title: 'Three' }} }};
// The section as its reviewer read it.
const read = {{ p01: slide('p01'), p02: slide('p02'), p03: slide('p03') }};
const fix1 = [{{ page: 'p01', field: 'annotations', value: [{{ text: 'Gap 4 points' }}] }}];
const findings = [finding({{ id: 'F1', slides: ['p01'], fix: fix1 }}), finding({{ id: 'F2', slides: ['p02'], severity: 'minor', dimension: 'text', code: 'EDITORIAL', repair: 'Cut the second clause of the first point.', fix: [{{ page: 'p02', field: 'points.0', value: 'b' }}] }})];
const answer = {{ part: {{ kind: 'section', id: 'a', slides: ['p01', 'p02', 'p03'] }}, binding: 'b'.repeat(64), accepted: false, summary: 'Two pages want a mark and a cut.', rating: 6, opened: ['p01', 'p02', 'p03'],
  provenance: prov(), pages: [{{ slide: 'p01', verdict: 'major', checks: checks() }}, {{ slide: 'p02', verdict: 'minor', checks: checks() }}, {{ slide: 'p03', verdict: 'ok', checks: checks() }}], findings, completeness: completeness(findings),
  density: {{ deck: 'Judged by the spine reviewer for the whole deck.', pages: [] }} }};
await fs.mkdir(path.join(out, C.SECTION_REVIEW), {{ recursive: true }});
await fs.writeFile(path.join(out, C.SECTION_REVIEW, 'a.json'), JSON.stringify(answer));
await fs.writeFile(path.join(out, C.SECTION_REVIEW, 'a.packet.json'), JSON.stringify({{ part: 'a', binding: answer.binding,
  pages: ['p01', 'p02', 'p03'].map((id) => ({{ id, drawn: C.drawnHash(read[id]), source: C.sourceHash(pages[id]), page: pages[id] }})) }}));
// The build: p01 redrawn with F1's fix applied word for word and checked clean; p02 as read, on another page number; p03 rewritten otherwise.
const built = {{ slides: [slide('p01', 'Title with mark'), {{ ...slide('p02'), nodes: [slide('p02').nodes[0], {{ type: 'text', role: 'page-number', text: '9' }}] }}, slide('p03', 'Rewritten'), slide('p04'), slide('p05'), slide('p06')] }};
await C.recordPageChecks(out, {{ slides: new Map([['p01', built.slides[0]]]), pages: new Map([['p01', C.applyFixes(pages.p01, fix1)]]), blocking: () => [] }});
const standing = await C.standingSectionReviews(out, built);
'''


class SectionReviewTests(unittest.TestCase):
    def test_a_page_keeps_its_section_verdict_only_while_it_is_drawn_as_read_or_fixed_by_its_own_fixes(self):
        """Unchanged keeps its open findings; fixed by the review's own fixes closes them; changed otherwise is read again."""
        result = run_node(FIXTURE + '''
console.log(JSON.stringify({ status: standing.status, reread: standing.reread, slides: standing.parts[0].part.slides, carried: standing.parts[0].findings.map((f) => f.id),
  keys: Object.keys(standing.parts[0].findings[0]), record: standing.records[0] }));
''')
        self.assertEqual(result['status'], {'p01': {'part': 'a', 'read': 'fixed'}, 'p02': {'part': 'a', 'read': 'unchanged'}, 'p03': {'part': 'a', 'read': 'changed'}})
        self.assertEqual(result['reread'], ['p03', 'p04', 'p05', 'p06'])
        self.assertEqual(result['slides'], ['p01', 'p02'])
        # F2's fix was not applied, so it stays open; F1's was, so it is closed. The section review's own fields stay behind.
        self.assertEqual(result['carried'], ['sr-a.F2'])
        self.assertNotIn('fix', result['keys'])
        self.assertEqual(result['record']['closed'], 1)
        self.assertEqual(result['record']['reread'], ['p03'])

    def test_the_final_review_merges_standing_section_reviews_with_the_pages_it_reads(self):
        """The spine and the re-read pages join the standing reviews into one first pass that covers every page and drops none unsaid."""
        result = run_node(FIXTURE + '''
const fresh = { part: { kind: 'section', id: 's1', slides: ['p03', 'p04', 'p05', 'p06'] }, binding: 'a'.repeat(64), accepted: true, summary: 'The re-read pages are clean.', rating: 8,
  opened: ['p03', 'p04', 'p05', 'p06'], provenance: prov(), pages: ['p03', 'p04', 'p05', 'p06'].map((s) => ({ slide: s, verdict: 'ok', checks: checks() })), findings: [], completeness: completeness([]),
  density: { deck: 'Judged by the spine reviewer for the whole deck.', pages: [] } };
const spine = { part: { kind: 'spine', id: 'spine', slides: IDS }, binding: 'a'.repeat(64), accepted: true, summary: 'Sound argument, varied sequence, matching bookends.', rating: 8, opened: [], provenance: prov(), pages: [], findings: [],
  completeness: R.DECK_DIMENSIONS.map((d) => ({ dimension: d, result: 'clean', note: `Checked ${d} across the whole sequence; nothing to raise.` })),
  assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`])), density: { deck: 'No density profile was built for this fixture, so no medians are compared.', pages: [] } };
const { review, errors } = R.mergeReviewParts([fresh, spine], IDS, { standing: standing.parts, sectionReviews: standing.records });
const missing = R.mergeReviewParts([spine], IDS, { standing: standing.parts });
const sections = R.reviewSections(built, { only: standing.reread });
console.log(JSON.stringify({ errors, valid: R.validateReview(review, IDS), ids: review.findings.map((f) => f.id), verdicts: Object.fromEntries(review.pages.map((p) => [p.slide, p.verdict])),
  from: review.mergedFrom, reviews: review.sectionReviews.map((r) => r.carried), missing: missing.errors, sections: sections.map((s) => s.slides) }));
''')
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['valid'], [])
        self.assertEqual(result['ids'], ['sr-a.F2'])
        self.assertEqual(result['verdicts'], {'p01': 'ok', 'p02': 'minor', 'p03': 'ok', 'p04': 'ok', 'p05': 'ok', 'p06': 'ok'})
        self.assertEqual(result['from'], ['s1', 'spine', 'sr-a'])
        self.assertEqual(result['reviews'], [['sr-a.F2']])
        # A page neither a standing review nor a fresh part covers is refused, not dropped.
        self.assertTrue(any('p03' in e for e in result['missing']))
        self.assertEqual(result['sections'], [['p03', 'p04', 'p05', 'p06']])


class SectionReviewCliTests(unittest.TestCase):
    def run_cli(self, *args):
        done = subprocess.run(['node', os.path.join(ROOT, 'skills/professional-slides/runtime/section-review.mjs'), *args], capture_output=True, text=True, cwd=ROOT)
        return done.returncode, json.loads(done.stdout or 'null'), done.stderr

    def test_a_section_is_staged_only_on_clean_current_page_checks_and_its_answer_needs_closed_fixes(self):
        """Staged early, a review of pages that did not check clean, or changed since, would be read again at the end."""
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'pages'))
            part = {'pages': [{'id': 's1', 'kind': 'section', 'title': 'Section A'}, {'id': 'p1', 'type': 'chart-with-commentary', 'title': 'Revenue rose 12% in 2025', 'points': ['One point.']}]}
            with open(os.path.join(tmp, 'pages', 'a.pages.json'), 'w') as f:
                json.dump(part, f)
            with open(os.path.join(tmp, 'deck.pages.json'), 'w') as f:
                json.dump({'deck': {'schema': 'professional-slides.deck/v3', 'request': 'Why is the subject winning?'}, 'pages': [{'include': 'pages/a.pages.json'}]}, f)
            out = os.path.join(tmp, 'out')
            code, refused, _ = self.run_cli(os.path.join(tmp, 'deck.pages.json'), out, '--section', 'a')
            self.assertEqual(code, 2)
            self.assertTrue(any('s1 has no page check' in e for e in refused['errors']))
            run_node(f'''
import fs from 'node:fs';
import {{ recordPageChecks }} from '{KIT}/page-check.mjs';
const part = {json.dumps(part)};
const slide = (id) => ({{ id, nodes: [{{ type: 'text', role: 'action-title', text: id }}], componentInstances: [] }});
await recordPageChecks({json.dumps(out)}, {{ slides: new Map([['s1', slide('s1')], ['p1', slide('p1')]]), pages: new Map(part.pages.map((p) => [p.id, p])), blocking: () => [] }});
for (const id of ['s1', 'p1']) fs.writeFileSync(`{out}/page-check/${{id}}.png`, 'png');
console.log('null');
''')
            code, staged, _ = self.run_cli(os.path.join(tmp, 'deck.pages.json'), out, '--section', 'a')
            self.assertEqual(code, 3, staged)
            self.assertEqual(staged['pages'], 2)
            with open(os.path.join(staged['packetDir'], 'prompt.md')) as f:
                prompt = f.read()
            self.assertIn('FIXES ARE CLOSED', prompt)
            record = json.load(open(os.path.join(out, 'section-review', 'a.packet.json')))
            # An answer whose finding has no fix, and one whose fix writes the title the critique is bound to, are refused.
            finding = {'id': 'F1', 'scope': 'page', 'slides': ['p1'], 'dimension': 'chart', 'code': 'UNANNOTATED_PLOT', 'severity': 'major', 'reason': 'The rise the title states is not marked.',
                       'repair': 'Annotate the 2025 bar with the 12% rise.', 'touches': ['copy'], 'checkable': None}
            retitle = dict(finding, id='F2', fix=[{'page': 'p1', 'field': 'title', 'value': 'Revenue rose 12%'}])
            answer = {'part': {'kind': 'section', 'id': 'a', 'slides': ['s1', 'p1']}, 'binding': record['binding'], 'accepted': False, 'summary': 'One chart wants its mark.', 'rating': 6, 'opened': ['s1', 'p1'],
                      'provenance': {'backend': 'subagent', 'model': 'fixture-model', 'promptHash': record['promptHash']},
                      'pages': [{'slide': 's1', 'verdict': 'ok', 'checks': {d: 'checked' for d in ['argument', 'evidence', 'chart', 'table', 'text', 'layout', 'identity', 'sourcing']}},
                                {'slide': 'p1', 'verdict': 'major', 'checks': {d: 'checked' for d in ['argument', 'evidence', 'chart', 'table', 'text', 'layout', 'identity', 'sourcing']}}],
                      'findings': [finding, retitle], 'completeness': [], 'density': {'deck': 'Judged by the spine reviewer for the whole deck.', 'pages': []}}
            path = os.path.join(out, 'section-review', 'a.json')
            with open(path, 'w') as f:
                json.dump(answer, f)
            code, verdict, _ = self.run_cli('--validate', path, os.path.join(tmp, 'deck.pages.json'), out)
            self.assertEqual(code, 2)
            text = ' '.join(verdict['errors'])
            self.assertIn('F1: give `fix`', text)
            self.assertIn('writes `title`', text)
            # A page written after its check is not staged: the review would bind to a drawing that no longer stands.
            part['pages'][1]['points'] = ['Another point.']
            with open(os.path.join(tmp, 'pages', 'a.pages.json'), 'w') as f:
                json.dump(part, f)
            code, refused, _ = self.run_cli(os.path.join(tmp, 'deck.pages.json'), out, '--section', 'a')
            self.assertEqual(code, 2)
            self.assertTrue(any('p1 was written after its page check' in e for e in refused['errors']))


if __name__ == '__main__':
    unittest.main()
