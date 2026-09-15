import unittest
from test_source_structure import run_node


class NativeTextStyleAuditTests(unittest.TestCase):
    def test_effective_runs_and_inherited_styles_are_checked_per_character(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {auditNativeTextStyle} from './evals/scripts/native_text_style_audit.mjs';
const node={id:'mixed',text:'Lead & detail',runs:[{text:'Lead',bold:true},{text:' & detail',bold:false}],style:{fontFamily:{value:'Arial'},fontSize:{value:12},bold:true}};
const defaults='<a:pPr><a:defRPr sz="1200"><a:latin typeface="Arial"/></a:defRPr></a:pPr>';
const run=(text,attrs='')=>`<a:r><a:rPr ${attrs}/><a:t>${text}</a:t></a:r>`;
const block=`<a:p>${defaults}${run('Lead','b="1"')}${run(' &amp; ')}</a:p><a:p>${defaults}${run('detail')}</a:p>`;
assert.deepEqual(auditNativeTextStyle(block,node),[]);
assert.equal(auditNativeTextStyle(block.replace('b="1"','b="0"'),node)[0].characterOffset,0);
assert.equal(auditNativeTextStyle(block.replace(run('detail'),run('detail','b="1"')),node)[0].characterOffset,5);
assert.equal(auditNativeTextStyle(block.replace(run('detail'),run('detail','sz="1100"')),node)[0].actual.size,1100);
assert.equal(auditNativeTextStyle(block.replace('detail','detaiX'),node)[0].actual.text,'X');
assert.ok(auditNativeTextStyle(undefined,node).length);
const inheritedBold=block.replaceAll('sz="1200"','sz="1200" b="1"');
assert.equal(auditNativeTextStyle(inheritedBold,node)[0].characterOffset,4);
const explicitRegular=inheritedBold.replace(run(' &amp; '),run(' &amp; ','b="0"')).replace(run('detail'),run('detail','b="0"'));
assert.deepEqual(auditNativeTextStyle(explicitRegular,node),[]);
const plain={...node,text:'Ordinary',runs:undefined,style:{...node.style,bold:false}};
assert.deepEqual(auditNativeTextStyle(`<a:p>${defaults}${run('Ordinary')}</a:p>`,plain),[]);
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result['ok'])
