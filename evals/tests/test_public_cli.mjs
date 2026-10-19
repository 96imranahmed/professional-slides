import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execute } from '../../skills/professional-slides/runtime/command.mjs';
import { newWorkspace, editWorkspace, openWorkspace, fingerprint, digest } from '../../skills/professional-slides/runtime/public/workspace.mjs';
import { applyCandidate } from '../../skills/professional-slides/runtime/public/candidates.mjs';
import { referenceExample } from '../../skills/professional-slides/runtime/reference-page.mjs';
import { compileDeck } from '../../skills/professional-slides/runtime/author-deck.mjs';
import { composeAll } from '../../skills/professional-slides/runtime/compose-all.mjs';

const temp=()=>fs.mkdtemp(path.join(os.tmpdir(),'ps-cli-test-'));
const doc=()=>({deck:{schema:'professional-slides.deck/v3',id:'deck',contents:false},pages:[{id:'one',type:'statement',form:'statement',title:'The decision is clear',text:'Protect the original words',commentary:'none'}]});

test('discovery exposes the reference schema and rejects unknown flags',async()=>{
  const result=await execute(['catalog','--type','reference','--schema','--json']);
  assert.equal(result.status,'complete');
  assert.equal(result.schemaDefinition.properties.nodes.items.properties.kind.enum.includes('text'),true);
  await assert.rejects(execute(['catalog','--invented']),/Unknown option/);
  await assert.rejects(execute(['inspect']),/inspect WORK/);
});
test('workspace creation never overwrites an existing deck',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await newWorkspace(dir,doc());
  await assert.rejects(newWorkspace(dir,doc()),/already exists/);
  assert.equal((await openWorkspace(dir)).doc.pages[0].text,'Protect the original words');
});
test('design edits refuse text changes and content edits preserve revision identity',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const work=await newWorkspace(dir,doc());
  await assert.rejects(editWorkspace(work,{scope:'design',edits:[{page:'one',value:{...work.doc.pages[0],text:'Changed'}}]}),/changes content/);
  assert.equal((await openWorkspace(dir)).doc.pages[0].text,'Protect the original words');
  const changed=await editWorkspace(work,{scope:'content',edits:[{page:'one',value:{...work.doc.pages[0],text:'An authorised content revision'}}]});
  assert.equal(changed.status,'complete');
});
test('new pages can be added by content edits, never by design edits',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const work=await newWorkspace(dir);
  await assert.rejects(editWorkspace(work,{scope:'design',edits:[{page:'new',value:doc().pages[0]}]}),/content scope/);
  assert.equal((await editWorkspace(work,{scope:'content',edits:[{page:'new',value:doc().pages[0]}]})).status,'complete');
});
test('candidate selection refuses stale source and modified saved records',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const work=await newWorkspace(dir,doc());
  const set='set-0123456789ab-01234567',id=set+'-01',folder=path.join(dir,'candidates',set,id);
  await fs.mkdir(folder,{recursive:true});
  const record={sourceHash:await fingerprint(work),doc:doc(),sourcePage:'one',contentHash:'unused'};
  const file=path.join(folder,'candidate.json');
  await fs.writeFile(file,JSON.stringify(record));
  await fs.writeFile(path.join(dir,'candidates',set,'candidates.json'),JSON.stringify({candidates:[{id,recordHash:digest(record)}]}));
  record.doc.pages[0].text='Tampered';
  await fs.writeFile(file,JSON.stringify(record));
  assert.equal((await applyCandidate(work,id)).findings[0].code,'CANDIDATE_CHANGED');
  await fs.writeFile(work.file,JSON.stringify({...work.doc,deck:{...work.doc.deck,footer:'Changed'}}));
  assert.equal((await applyCandidate(await openWorkspace(dir),id)).findings[0].code,'CANDIDATE_STALE');
});
test('image import returns authoring data, and native reference nodes reach the common scene compiler',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const source=path.resolve('assets/sample-trend.png');
  const imported=await execute(['import',source,'--out',path.join(dir,'work'),'--json']);
  assert.equal(imported.status,'needs-input');
  assert.equal(imported.requiredInputs[0].kind,'reference-page');
  const work=await openWorkspace(path.join(dir,'work'));
  const page=referenceExample();page.reference='sources/reference.png';
  const written=await editWorkspace(work,{scope:'content',edits:[{page:'reference-1',value:page}]});
  assert.equal(written.status,'complete');
  const current=await openWorkspace(work.root);
  const compiled=compileDeck(current.doc);
  const scene=composeAll(compiled.spec,current.root).deck;
  assert.equal(scene.slides[0].nodes.filter(n=>n.type==='text').length,1);
  assert.equal(scene.slides[0].nodes[0].text,page.nodes[0].text);
  const bad={...page,nodes:[{id:'screenshot',kind:'image',src:page.reference,frame:{x:0,y:0,width:1280,height:720}}]};
  assert.throws(()=>composeAll(compileDeck({...current.doc,pages:[bad]}).spec,current.root),/cannot stand in/);
});

test('the shipped reference example compiles to editable text rather than a flattened picture',async()=>{
  const base=path.resolve('skills/professional-slides/examples');
  const example=JSON.parse(await fs.readFile(path.join(base,'reference.pages.json'),'utf8'));
  const scene=composeAll(compileDeck(example).spec,base).deck;
  assert.equal(scene.slides[0].nodes.filter(n=>n.type==='image').length,0);
  assert.equal(scene.slides[0].nodes[0].text,'A native title');
});
