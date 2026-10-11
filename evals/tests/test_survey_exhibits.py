"""Survey exhibits: the question, a Likert scale, statements over their bars, verbatims beside them.

A survey chart answers a question its heading cannot hold, so the question is
set under the heading with its base. A Likert scale lines up on its neutral
answer, its disagreement left of zero and its agreement right, printed
unsigned. A long statement sits over its bar, and what respondents said sits
level with it, marked for or against. Each test renders the chart and reads
where the parts went.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { nativeChartSpec } from './skills/professional-slides/runtime/core.mjs';
const frame = { x: 60, y: 180, width: 1160, height: 470 };
const render = (kind, props) => REGISTRY.get(kind).render({ id: 'c', frame, props }).nodes;
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const statements = ['Trains run often enough', 'Fares are fair for the journey', 'Trains are reliable', 'Stations feel safe', 'Information is clear'];
const likert = { categories: statements, series: [
  { name: 'Strongly disagree', values: [22, 12, 8, 5, 4] }, { name: 'Disagree', values: [28, 20, 17, 12, 10] }, { name: 'Neutral', values: [14, 24, 25, 23, 21] },
  { name: 'Agree', values: [24, 30, 35, 40, 42] }, { name: 'Strongly agree', values: [12, 14, 15, 20, 23] }], diverging: { neutral: 'Neutral' } };
const QUESTION = 'Thinking about the trains you use most often, which one of these changes would most make you travel by train more often than you do today?';
"""


class QuestionTests(unittest.TestCase):
    def test_the_question_sits_under_the_heading_with_its_base(self):
        run_node(PRELUDE + """
const props = { heading: 'Most important improvement', unit: '%', categories: ['Frequency', 'Fares', 'Trains', 'Reliability'], series: [{ name: 'Share', values: [31, 22, 14, 12] }], question: { text: QUESTION, base: 1204 } };
const nodes = render('chart.bar', props), plain = render('chart.bar', { ...props, question: undefined });
const heading = nodes.find((n) => n.role === 'chart-heading' || n.role === 'chart-title' || n.role === 'section-heading');
const question = nodes.find((n) => n.role === 'chart-question'), base = nodes.find((n) => n.role === 'chart-question-base');
assert.ok(question.text.startsWith('“Thinking'), 'quoted');
assert.equal(base.text, 'n = 1,204');
assert.ok(nodes.some((n) => n.role === 'chart-question-badge-label' && n.text === 'Q'));
const topBar = (list) => Math.min(...list.filter((n) => n.role === 'chart-mark').map((n) => n.frame.y));
assert.ok(topBar(nodes) > base.frame.y + base.frame.height, 'the plot starts under the base');
assert.ok(topBar(nodes) > topBar(plain), 'and gives up the question its room');
assert.equal(nativeChartSpec('chart.bar', props, frame, nodes), null, 'a native chart would cover the question');
console.log('{}');
""")

    def test_a_question_past_three_lines_is_refused(self):
        message = run_node(PRELUDE + """
const long = Array.from({ length: 6 }, () => QUESTION).join(' ');
console.log(JSON.stringify({ message: error(() => REGISTRY.get('chart.bar').render({ id: 'c', frame: { ...frame, width: 500 }, props: { categories: ['A', 'B', 'C', 'D'], series: [{ name: 'x', values: [1, 2, 3, 4] }], question: { text: long } } })) }));
""")["message"]
        self.assertIn("3 at most", message)


class LikertTests(unittest.TestCase):
    def test_the_scale_lines_up_on_its_neutral_answer(self):
        run_node(PRELUDE + """
const nodes = render('chart.stacked-bar', likert);
const mark = (s, c) => nodes.find((n) => n.role === 'chart-mark' && n.data.series === s && n.data.category === c).frame;
const centre = nodes.find((n) => n.role === 'chart-diverging-centre').frame;
const zero = centre.x + centre.width / 2;
for (const statement of statements) {
  const neutral = mark('Neutral', statement);
  assert.ok(Math.abs(neutral.x + neutral.width / 2 - zero) < 1, `${statement}: the neutral answer straddles zero`);
  assert.ok(mark('Disagree', statement).x + mark('Disagree', statement).width <= neutral.x + 0.5, 'disagreement stacks out to the left');
  assert.ok(mark('Strongly disagree', statement).x < mark('Disagree', statement).x, 'the strongest answer outermost');
  assert.ok(mark('Agree', statement).x >= neutral.x + neutral.width - 0.5, 'agreement to the right');
}
const labels = nodes.filter((n) => n.role === 'data-label').map((n) => n.text);
assert.ok(labels.includes('22') && !labels.some((t) => t.startsWith('-') || t.startsWith('−')), 'printed unsigned');
// Behind the bars, so it never crosses the neutral answer's figure.
assert.ok(nodes.findIndex((n) => n.role === 'chart-diverging-centre') < nodes.findIndex((n) => n.role === 'chart-mark'));
assert.ok(!nodes.some((n) => n.role === 'chart-axis' && n.id.endsWith('y-axis')), 'the axis at zero gives way to the centre');
const fill = (s) => nodes.find((n) => n.role === 'chart-mark' && n.data.series === s).style.fill.tokenId;
assert.equal(fill('Strongly disagree'), 'color.heat.red-white-green.0');
assert.equal(fill('Strongly agree'), 'color.heat.red-white-green.10');
assert.equal(fill('Neutral'), 'color.chartComparator');
assert.equal(nativeChartSpec('chart.stacked-bar', likert, frame, nodes), null);
console.log('{}');
""")

    def test_a_scale_that_cannot_diverge_is_refused(self):
        found = run_node(PRELUDE + """
console.log(JSON.stringify({
  middle: error(() => render('chart.stacked-bar', { ...likert, diverging: true })),
  unknown: error(() => render('chart.stacked-bar', { ...likert, diverging: { neutral: 'Unsure' } })),
  signed: error(() => render('chart.stacked-bar', { ...likert, series: likert.series.map((s, i) => (i ? s : { ...s, values: s.values.map((v) => -v) })) })),
  bar: error(() => render('chart.bar', { categories: statements, series: [likert.series[0]], diverging: true })),
}));
""")
        self.assertIn("name it in diverging.neutral", found["middle"])
        self.assertIn("names the middle answer", found["unknown"])
        self.assertIn("none below zero", found["signed"])
        self.assertIn("does not draw a diverging scale", found["bar"])


class StatementTests(unittest.TestCase):
    def test_a_statement_sits_over_its_bar_and_its_verbatim_beside_it(self):
        run_node(PRELUDE + """
const props = { categories: ['I would travel by train more if trains ran every fifteen minutes', 'I would travel more often if off-peak fares were lower', 'Newer trains would make me choose rail over the car', 'Better parking at stations would change how I travel'],
  series: [{ name: 'Agree', values: [64, 48, 31, 22] }], categoryLabel: 'above',
  rowNotes: [{ text: 'I drive because the next train is often an hour away', quote: true, tone: 'negative', arrow: true }, 'Off-peak is fine', null, { text: 'The car park fills by 8am', tone: 'positive' }] };
const nodes = render('chart.bar', props);
const mark = (i) => nodes.find((n) => n.role === 'chart-mark' && n.data.category === props.categories[i]).frame;
const label = (i) => nodes.find((n) => n.role === 'category-label' && n.data.category === props.categories[i]).frame;
for (let i = 0; i < 4; i += 1) {
  assert.ok(label(i).y + label(i).height <= mark(i).y + 1, `statement ${i + 1} over its bar`);
  assert.ok(Math.abs(label(i).x - mark(i).x) < 10, 'starting where its bar does');
}
const notes = nodes.filter((n) => n.role === 'chart-row-note');
assert.equal(notes.length, 3, 'a null row stays bare');
assert.ok(notes[0].text.startsWith('“'), 'a quote is quoted');
const rightOfValues = Math.max(...nodes.filter((n) => ['chart-mark', 'data-label'].includes(n.role)).map((n) => n.frame.x + n.frame.width));
assert.ok(notes.every((n) => n.frame.x >= rightOfValues), 'the column stands past the values');
for (const note of notes) { const row = mark(props.categories.indexOf(note.data.category)); assert.ok(Math.abs(note.frame.y + note.frame.height / 2 - (row.y + row.height / 2)) < 2, 'level with its bar'); }
assert.equal(nodes.find((n) => n.role === 'chart-row-note-tone' && n.data.category === props.categories[0]).style.fill.tokenId, 'color.negative');
assert.ok(nodes.some((n) => n.role === 'annotation-leader' && n.data.rowNote), 'the leader back to its bar');
console.log('{}');
""")

    def test_notes_and_labels_that_do_not_fit_their_chart_are_refused(self):
        found = run_node(PRELUDE + """
const cats = ['A', 'B', 'C', 'D'], series = [{ name: 'x', values: [4, 3, 2, 1] }];
console.log(JSON.stringify({
  column: error(() => render('chart.column', { categories: cats, series, categoryLabel: 'above' })),
  count: error(() => render('chart.bar', { categories: cats, series, rowNotes: ['one'] })),
  tone: error(() => render('chart.bar', { categories: cats, series, rowNotes: [{ text: 'x', tone: 'good' }, null, null, null] })),
}));
""")
        self.assertIn("column chart names its columns under them", found["column"])
        self.assertIn("one entry a category", found["count"])
        self.assertIn("a voice for, against or neither", found["tone"])


class VoiceTests(unittest.TestCase):
    def test_a_voice_for_or_against_is_marked_and_its_portrait_sized(self):
        run_node(PRELUDE + """
const cluster = REGISTRY.get('quote-cluster');
const quotes = [{ quote: 'Half-hourly trains mean I leave the car at home.', attribution: 'Commuter', avatarText: 'VL', tone: 'positive' }, { quote: 'The first train is still too late for the early shift.', attribution: 'Nurse', avatarText: 'EL', tone: 'negative' }];
const props = { quotes, treatment: 'contained', placement: 'full-field', arrangement: 'grid', avatar: true, avatarSize: 48, attributionAlign: 'left' };
const nodes = cluster.render({ id: 'q', frame: { x: 60, y: 160, width: 1160, height: 480 }, props }).nodes;
assert.deepEqual(nodes.filter((n) => n.role === 'quote-tone').map((n) => n.style.fill.tokenId), ['color.positive', 'color.negative']);
assert.equal(nodes.find((n) => n.role === 'quote-mark' && n.data.tone === 'negative').style.color.tokenId, 'color.negative');
assert.ok(nodes.filter((n) => n.role === 'quote-avatar').every((n) => n.frame.width === 48));
assert.throws(() => cluster.render({ id: 'q', frame: { x: 60, y: 160, width: 1160, height: 480 }, props: { ...props, avatar: false } }), /avatarSize sizes the portraits/);
assert.throws(() => cluster.render({ id: 'q', frame: { x: 60, y: 160, width: 1160, height: 480 }, props: { ...props, avatarSize: 200 } }), /24 to 72/);
console.log('{}');
""")


if __name__ == "__main__":
    unittest.main()
