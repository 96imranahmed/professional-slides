// Explicit integration tier: real local Office exports, not mocked previews.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execute } from '../../skills/professional-slides/runtime/command.mjs';
import { newWorkspace, openWorkspace } from '../../skills/professional-slides/runtime/public/workspace.mjs';
import { workedExamples } from '../../skills/professional-slides/runtime/author-deck.mjs';

process.env.PROFESSIONAL_SLIDES_RENDERER=process.env.PS_TEST_RENDERER||'libreoffice';
const workdir=async t=>{const p=await fs.mkdtemp(path.join(os.tmpdir(),'ps-cli-render-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));return p;};
const ok=r=>assert.equal(r.status,'complete',JSON.stringify(r,null,2));

test('real-content options, and a design option that restyles the deck without losing a page',async t=>{
  const root=await workdir(t), all=workedExamples().pages;
  const first=all.find(p=>p.type==='trend'&&p.form==='line'),second=all.find(p=>p.type==='lookup'&&p.form==='table');
  // A cover moves every page one place along in the scene: the option's preview must still be its own page.
  await newWorkspace(root+'/work',{deck:{schema:'professional-slides.deck/v3',id:'deck',contents:false,cover:{title:'Options'}},pages:[first,second]});
  const variants=await execute(['options',root+'/work','--slide','1','--count','3']);ok(variants);
  assert.equal(variants.produced,3);
  for(const c of variants.candidates){
    const scene=JSON.parse(await fs.readFile(path.join(path.dirname(c.image),'..','scene.json'),'utf8'));
    assert.equal(scene.slides[Number(path.basename(c.image).match(/\d+/)[0])-1].id,first.id);
  }
  const redesign=await execute(['options',root+'/work','--slide','1','--design','editorial','--count','1']);ok(redesign);
  assert.deepEqual(redesign.restyled,[second.id]);
  ok(await execute(['apply',root+'/work','--candidate',redesign.candidates[0].id]));
  const applied=(await openWorkspace(root+'/work')).doc;
  assert.equal(applied.deck.design,'editorial');
  assert.deepEqual(applied.pages[1],second);
  const built=await execute(['build',root+'/work','--out',root+'/out']);ok(built);
  assert.equal(built.artifacts.filter(f=>f.endsWith('.pptx')).length,1);
});
test('image reconstruction emits native text and a source/output comparison',async t=>{
  const root=await workdir(t), fixture=path.resolve('skills/professional-slides/examples');
  const imported=await execute(['import',fixture+'/assets/reference.png','--out',root+'/work']);
  assert.equal(imported.status,'needs-input');
  const doc=JSON.parse(await fs.readFile(fixture+'/reference.pages.json','utf8'));
  doc.pages[0].reference='sources/reference.png';
  await fs.writeFile(root+'/patch.json',JSON.stringify({scope:'content',edits:[{page:'reference-1',value:doc.pages[0]}]}));
  ok(await execute(['edit',root+'/work','--file',root+'/patch.json']));
  const built=await execute(['build',root+'/work','--out',root+'/out']);ok(built);
  assert.equal(built.editability.readbackAccepted,true);
  assert.equal(built.editability.textObjectsChecked,1);
  assert.equal(built.editability.pages[0].images,0);
  assert.ok(built.artifacts.some(f=>f.endsWith('reconstruction-comparison.png')));
});
test('brand style and template decks render and can be rebuilt in place',async t=>{
  const root=await workdir(t);
  const profile={schema:'professional-slides.house/v1',design:'consulting',palette:{base:'midnight',colors:{primary:'#183D36'}},typography:{body:'Arial',display:'Arial'}};
  await fs.writeFile(root+'/house.json',JSON.stringify(profile));
  const imported=await execute(['style','import',root+'/house.json','--out',root+'/brand.house.json']);ok(imported);
  for(let i=0;i<2;i++){
    const result=await execute(['style','build',root+'/brand.house.json','--out',root+'/brand']);ok(result);
    assert.ok(result.artifacts.some(f=>f.endsWith('brand-style-guide.pptx')));
    assert.ok(result.artifacts.some(f=>f.endsWith('brand-template.pptx')));
  }
});
