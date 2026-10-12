"""Row-group labels set on their side down a table's rows (`vertical: true` on a column).

A device audit found strong tables running each group's name down the left
edge of its rows in a filled cell, turned to read upwards, where the runtime
turned text only for a matrix's axis title and a side rail's tabs. The column
is as narrow as its labels' lines; a label stretches its rows by half again at
most, on one line or two, and past that is refused as too long for its rows.
"""
import unittest

from node_probe import run_node

PRELUDE = """
import assert from 'node:assert/strict';
import { renderTable, measureTable } from './skills/professional-slides/runtime/tables.mjs';
import { inkBox, sceneCollisions } from './skills/professional-slides/runtime/validate-overlap.mjs';
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const frame = { x: 60, y: 140, width: 1160, height: 480 };
const side = { label: '', type: 'category', vertical: true };
const rows = (group, n, label = 'Group') => [[{ text: label, rowSpan: n }, `${group} option 1`, '6.4'], ...Array.from({ length: n - 1 }, (_, i) => [null, `${group} option ${i + 2}`, '3.1'])];
const table = (rowsIn, columns = [side, 'Option', 'Value, £m'], extra = {}) => renderTable({ id: 't', frame, props: { treatment: 'categories', columns, rows: rowsIn, ...extra } }).nodes;
"""


class VerticalLabelTests(unittest.TestCase):
    def test_a_group_label_runs_up_its_rows_in_a_narrow_filled_column(self):
        run_node(PRELUDE + """
const nodes = table([...rows('Running', 4, 'Running the trains'), ...rows('Selling', 3, 'Selling them')]);
const labels = nodes.filter((n) => n.data?.vertical);
assert.deepEqual(labels.map((n) => n.text), ['Running the trains', 'Selling them']);
assert.ok(labels.every((n) => n.style.rotate === -90), 'turned a quarter back, to read upwards');
const fill = nodes.find((n) => n.role === 'table-cell' && n.data.column === 0 && n.data.row === 0);
assert.equal(fill.data.rowSpan, 4);
assert.ok(fill.frame.width < 50, `one line wide (${fill.frame.width}px)`);
// The label, turned, stands inside its filled cell: its ink is tall and narrow, centred on the cell.
const ink = inkBox(labels[0]);
assert.ok(ink.height > ink.width, 'the ink runs down the rows');
assert.ok(ink.x >= fill.frame.x - 1 && ink.x + ink.width <= fill.frame.x + fill.frame.width + 1);
assert.ok(ink.y >= fill.frame.y - 1 && ink.y + ink.height <= fill.frame.y + fill.frame.height + 1);
// Read turned, it overlaps no other text: unturned, its run lay across the option names beside it.
assert.equal(sceneCollisions({ id: 's', nodes }).filter((f) => f.code === 'TEXT_ON_TEXT').length, 0);
// The rows beside the run are not centred on it as on a one-row block.
const first = nodes.find((n) => n.role === 'table-cell-text' && n.text === 'Running option 1');
const top = Math.min(...nodes.filter((n) => n.role === 'table-cell-text' && /option/.test(n.text)).map((n) => n.frame.y));
assert.equal(first.frame.y, top);
console.log('{}');
""")

    def test_a_long_label_takes_two_lines_then_is_refused(self):
        found = run_node(PRELUDE + """
// Two rows of one line each hold "Running" on one line; a longer name runs past half again their height and the
// column widens to set it on two.
const two = table(rows('Running', 2, 'Running the recast trains'));
const label = two.find((n) => n.data?.vertical);
const fill = two.find((n) => n.role === 'table-cell' && n.data.column === 0);
console.log(JSON.stringify({
  lines: label.text.split('\\n').length,
  width: fill.frame.width,
  one: table(rows('Running', 2, 'Running')).find((n) => n.role === 'table-cell' && n.data.column === 0).frame.width,
  long: error(() => table(rows('Running', 1, 'Every train on every line runs to the recast timetable from December'))),
  header: error(() => table(rows('Running', 2), [{ ...side, label: 'Group' }, 'Option', 'Value, £m'])),
  type: error(() => table(rows('Running', 2), [{ ...side, type: 'number' }, 'Option', 'Value, £m'], { treatment: 'standard' })),
  stray: error(() => table([[{ text: 'Group', vertical: true }, 'Option 1', '6.4']], ['Group', 'Option', 'Value, £m'], { treatment: 'standard' })),
  marker: error(() => table([[{ text: 'Group', sectionNumber: 1 }, 'Option 1', '6.4']])),
}));
""")
        self.assertEqual(found["lines"], 2)
        self.assertGreater(found["width"], found["one"])
        self.assertIn("on two lines", found["long"])
        self.assertIn("stretches its rows by half again at most", found["long"])
        self.assertIn("let it span more rows", found["long"])
        self.assertIn("leave its `label` empty", found["header"])
        self.assertIn("category or text cells", found["type"])
        self.assertIn("set `vertical: true` on its column", found["stray"])
        self.assertIn("numbered disc or an icon", found["marker"])


if __name__ == "__main__":
    unittest.main()
