"""Quotes where a spectrum and a table set them: a voice at each pole of a spectrum row, and a quote cell.

A device audit found strong pages quoting someone at each end of a spectrum
row - "There are many factors beyond my control" against "I can learn new
things" - and setting a table's cells as signed quotes, market feedback by
country. A spectrum row took one `text` under its track, and a table cell had
no quote of its own.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { renderTable } from './skills/professional-slides/runtime/tables.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const frame = { x: 60, y: 140, width: 1160, height: 420 };
const spectrum = (props, f = frame) => REGISTRY.get('spectrum').render({ id: 's', frame: f, props }).nodes;
const row = (quotes, o = {}) => ({ left: 'Built for the peak', right: 'Built for all day', value: 0.3, quotes, ...o });
const table = (rows, columns = ['Line', { label: 'What riders say', type: 'quote' }]) => renderTable({ id: 't', frame, props: { columns, rows } }).nodes;
"""


class SpectrumQuoteTests(unittest.TestCase):
    def test_each_pole_speaks_under_its_own_end_of_the_row(self):
        run_node(PRELUDE + """
const nodes = spectrum({ items: [row({ left: 'I travel at eight and at six.', right: '"I would shop by train if one came every half hour."' }), row({ left: 'My season ticket pays for itself.' }, { left: 'Season tickets', right: 'Pay as you go' })] });
const quotes = nodes.filter((n) => n.role === 'spectrum-quote');
assert.equal(quotes.length, 3, 'a row may quote one pole');
const [left, right] = quotes;
assert.equal(left.text, '“I travel at eight and at six.”', 'set in quotation marks');
assert.equal(right.text, '“I would shop by train if one came every half hour.”', 'the author\\'s own marks taken off first');
assert.equal(left.frame.x, frame.x);
assert.equal(left.style.align, 'left');
assert.ok(Math.abs(right.frame.x + right.frame.width - (frame.x + frame.width)) < 0.5);
assert.equal(right.style.align, 'right');
assert.ok(left.frame.x + left.frame.width <= right.frame.x, 'two halves, a gutter between');
// Under the row's poles and track, and over the next row.
const pole = nodes.find((n) => n.role === 'spectrum-pole');
const next = nodes.filter((n) => n.role === 'spectrum-pole')[2];
assert.ok(left.frame.y >= pole.frame.y + pole.frame.height);
assert.ok(left.frame.y + left.frame.height <= next.frame.y);
console.log('{}');
""")

    def test_what_a_pole_cannot_say_is_refused(self):
        found = run_node(PRELUDE + """
const long = 'I plan the whole of my working week around the hourly timetable, and when a train is cancelled I lose a morning, sometimes a whole day, because the next one is an hour later and the one after that is often full before it reaches my station. '.repeat(2);
console.log(JSON.stringify({
  empty: error(() => spectrum({ items: [row({}), row({ left: 'x' })] })),
  shape: error(() => spectrum({ items: [row(['one', 'two']), row({ left: 'x' })] })),
  key: error(() => spectrum({ items: [row({ middle: 'x' }), row({ left: 'x' })] })),
  both: error(() => spectrum({ items: [row({ left: 'x' }, { text: 'A note under the track' }), row({ left: 'y' })] })),
  pole: error(() => spectrum({ segments: 5, items: [{ left: 'Impact', level: 3, quotes: { right: 'x' } }, { left: 'Speed', level: 2 }] })),
  long: error(() => spectrum({ items: [row({ left: long }), row({ left: 'x' })] })),
}));
""")
        self.assertIn("{ left, right }", found["empty"])
        self.assertIn("{ left, right }", found["shape"])
        self.assertIn("{ left, right }", found["key"])
        self.assertIn("keep the quotes, or the note", found["both"])
        self.assertIn("does not name", found["pole"])
        self.assertIn("3 lines at most", found["long"])


class QuoteCellTests(unittest.TestCase):
    def test_a_quote_cell_is_set_as_said_and_signed_at_its_foot(self):
        run_node(PRELUDE + """
const nodes = table([['Dales', { text: 'On a Saturday the 09:10 is full.', by: 'Day walker, Leeds' }], ['Valley', 'The last train leaves before the film ends.']]);
const said = nodes.filter((n) => n.role === 'table-cell-text' && n.text.startsWith('“'));
assert.deepEqual(said.map((n) => n.text), ['“On a Saturday the 09:10 is full.”', '“The last train leaves before the film ends.”'], 'a column of quotes, a cell signed or not');
const by = nodes.find((n) => n.role === 'table-cell-attribution');
assert.equal(by.text, 'Day walker, Leeds');
assert.equal(by.style.bold, true);
assert.equal(by.style.align, 'right');
assert.ok(by.frame.y >= said[0].frame.y + said[0].frame.height, 'under the words it signs');
assert.equal(nodes.filter((n) => n.role === 'table-cell-attribution').length, 1);
console.log('{}');
""")

    def test_what_a_quote_cell_cannot_hold_is_refused(self):
        found = run_node(PRELUDE + """
const long = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
console.log(JSON.stringify({
  long: error(() => table([['Dales', long]])),
  stray: error(() => table([['Dales', { text: 'Full trains', by: 'A rider' }]], ['Line', 'Verdict'])),
  by: error(() => table([['Dales', { text: 'Full trains', by: '' }]])),
}));
""")
        self.assertIn("45 words", found["long"])
        self.assertIn('set `type: "quote"`', found["stray"])
        self.assertIn("names who said it", found["by"])


if __name__ == "__main__":
    unittest.main()
