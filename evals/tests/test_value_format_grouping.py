import unittest
from test_source_structure import run_node


class ValueFormatGroupingTests(unittest.TestCase):
    def test_grouping_preserves_sign_precision_and_compact_scaling(self):
        result = run_node(r'''
import assert from 'node:assert/strict';
import {formatValue} from './skills/professional-slides/runtime/value-format.mjs';
assert.equal(formatValue(12345.678901,{valueFormat:{grouping:true,decimals:6,prefix:'$'}}),'$12,345.678901');
assert.equal(formatValue(-12345.6,{valueFormat:{grouping:true,decimals:2}}),'-12,345.60');
assert.equal(formatValue(12345,{valueFormat:{grouping:true,decimals:0,sign:'always'}}),'+12,345');
assert.equal(formatValue(12345,{valueFormat:{decimals:0}}),'12345');
assert.equal(formatValue(1234500,{valueFormat:{grouping:true,compactUnit:'k',decimals:1}}),'1,234.5k');
assert.throws(()=>formatValue(10,{valueFormat:{grouping:'yes'}}),/must be boolean/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])
