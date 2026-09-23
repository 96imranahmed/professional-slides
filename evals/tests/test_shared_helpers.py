"""Helpers that exist once.

`measure` was defined in six runtime modules with four different argument
orders, `rect` and `label` in three each, and the thousands-grouping regex in
two - so a fix in one was not a fix in the others, and calling one module's
helper with another's argument order silently measured the wrong thing. They
live in `runtime/draw.mjs`; these tests keep them there.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from node_probe import run_node

RUNTIME = Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "runtime"
SOURCES = {path.name: path.read_text(encoding="utf-8") for path in RUNTIME.glob("*.mjs")}


class SingleDefinitionTests(unittest.TestCase):
    """A module may keep a one-line alias in its own argument order; what it may
    not do is write the helper's body again."""

    def _local_helper_bodies(self, helper):
        # `const measure = (...) => <body>` / `const rect = (...) => <body>`,
        # anywhere but draw.mjs itself.
        pattern = re.compile(rf"^const {helper} = \([^)]*\) =>(.*)$", re.M)
        found = {}
        for name, src in SOURCES.items():
            if name == "draw.mjs":
                continue
            for body in pattern.findall(src):
                found.setdefault(name, []).append(body.strip())
        return found

    def test_measuring_is_delegated_not_rewritten(self):
        offenders = {name: bodies for name, bodies in self._local_helper_bodies("measure").items()
                     if any("measureAt" not in body for body in bodies)}
        self.assertFalse(offenders, f"these modules write their own measure: {sorted(offenders)}")

    def test_a_filled_box_is_delegated_not_rewritten(self):
        offenders = {}
        for helper in ("rect", "box"):
            for name, bodies in self._local_helper_bodies(helper).items():
                bad = [b for b in bodies if "rectPrimitive({" in b]
                if bad:
                    offenders[name] = bad
        self.assertFalse(offenders, f"these modules build their own filled box: {sorted(offenders)}")

    def test_a_measured_label_is_delegated_not_rewritten(self):
        offenders = {name: bodies for name, bodies in self._local_helper_bodies("label").items()
                     if any("textPrimitive({" in body for body in bodies)}
        self.assertFalse(offenders, f"these modules place their own measured label: {sorted(offenders)}")

    def test_the_thousands_rule_is_written_once(self):
        pattern = r"\\B\(\?=\(\\d\{3\}\)\+"
        holders = sorted(name for name, src in SOURCES.items() if re.search(pattern, src))
        self.assertEqual(holders, ["draw.mjs"], "the thousands-grouping rule has been copied again")


class BehaviourTests(unittest.TestCase):
    def test_the_shared_helpers_do_what_the_modules_expected(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {measureAt, fillRect, measuredLabel, groupThousands, sizeValue} from './skills/professional-slides/runtime/draw.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
createRegistry();
// A size is a token id, a token reference or a number.
assert.equal(typeof sizeValue('type.body'),'number');
assert.equal(sizeValue(13),13);
// Measuring is against the frame given, not a fraction of it.
const narrow=measureAt('a reasonably long line of body copy',120,{});
const wide=measureAt('a reasonably long line of body copy',420,{});
assert.ok(narrow.lines.length>wide.lines.length,'the width is respected');
assert.ok(measureAt('x',200,{bold:true}).width>=measureAt('x',200,{}).width);
// A filled box carries the hairline and the token radius.
const box=fillRect('b','panel-surface',{x:0,y:0,width:10,height:10},'#fff',{radius:'radius.small'});
assert.equal(box.role,'panel-surface');
assert.equal(box.style.stroke,'none');
// A measured label takes the layout's height and line height.
const layout=measureAt('two words',80,{});
const node=measuredLabel('l','label',{x:0,y:0,width:80,height:999},layout,{color:'#000'});
assert.equal(node.frame.height,layout.height);
assert.equal(node.style.lineHeight,layout.lineHeight);
assert.equal(node.data.textLayout,layout);
// Thousands group from four figures up, and not below.
assert.equal(groupThousands('10156'),'10,156');
assert.equal(groupThousands('999'),'999');
assert.equal(groupThousands('1234567'),'1,234,567');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
