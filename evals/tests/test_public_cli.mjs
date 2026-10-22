import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execute, COMMANDS } from '../../skills/professional-slides/runtime/command.mjs';
import { newWorkspace, editWorkspace, openWorkspace, fingerprint, digest, contentSignature, renderedSlide, rankedAdvisories } from '../../skills/professional-slides/runtime/public/workspace.mjs';
import { approvalMessage, shortPages, storylineProblems, uniformWords, fewPictures } from '../../skills/professional-slides/runtime/public/storyline.mjs';
import { ownerOf } from '../../skills/professional-slides/runtime/public/setup.mjs';
import { privateAddress, readSite } from '../../skills/professional-slides/runtime/site-design.mjs';
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

// A new deck waits for an approved storyline: asking for a deck is not approval.
const storyline=()=>({question:'How much upside?',answer:'150-250 units, $60-100m at list',
  reader:{audience:'strategy team',readerKnows:'the market basics',decision:'size the opportunity',density:'pre-read'},
  sections:[{role:'opening',pages:[{id:'summary',title:'Executive summary',type:'summary/executive-summary',says:{shape:'lead-text',count:4,of:'statements'}}]},
    {claim:'The installed base must be replaced',pages:[{id:'fleet',title:'Older units are ageing out',type:'ranking/bar',compares:'seven types by age',members:7,
      candidates:['ranking/bar','lookup/table'],data:{status:'to-find',what:'installed base by type and build year'},says:{shape:'lead-bullets',count:2,of:'reasons'}}]}],
  alternative:'10 pages: drops the installed-base detail'});
test('a new deck takes no page until the user approves its storyline, and builds only the pages they approved',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const prev=process.env.PROFESSIONAL_SLIDES_HOME;process.env.PROFESSIONAL_SLIDES_HOME=path.join(dir,'home');t.after(()=>{if(prev===undefined)delete process.env.PROFESSIONAL_SLIDES_HOME;else process.env.PROFESSIONAL_SLIDES_HOME=prev;});
  const work=path.join(dir,'w');
  const started=await execute(['init',work,'--json']);
  assert.equal(started.status,'needs-input');
  assert.equal(started.requiredInputs[0].kind,'storyline');
  const opened=await openWorkspace(work);
  assert.equal((await editWorkspace(opened,{scope:'content',edits:[{page:'new',value:doc().pages[0]}]})).status,'needs-input');
  assert.equal((await execute(['check',work])).status,'needs-input');
  await fs.writeFile(opened.file,JSON.stringify({...opened.doc,storyline:{...storyline(),reader:{audience:'strategy team'}}}));
  assert.equal((await execute(['storyline',work])).status,'blocked');
  await fs.writeFile(opened.file,JSON.stringify({...opened.doc,storyline:storyline()}));
  const shown=await execute(['storyline',work]);
  assert.equal(shown.status,'needs-input');
  assert.match(shown.requiredInputs[0].message,/^Storyline: 2 pages \(1 opening · 1 in 1 section\)/);
  // One shape at every length: a line or two a page in the message, each page's comparison in storyline.md beside it.
  assert.match(shown.requiredInputs[0].message,/2\* Older units are ageing out\n\s+ranking\/bar · 7 members · data to-find/);
  assert.match(shown.requiredInputs[0].message,/\* The data behind this page is still to find/);
  assert.match(await fs.readFile(path.join(work,'storyline.md'),'utf8'),/compares seven types by age \(7 members\)/);
  await assert.rejects(execute(['storyline',work,'--scaffold','--approve','yes']),/Choose/);
  assert.equal((await execute(['storyline',work,'--scaffold'])).status,'needs-input');
  assert.equal((await execute(['storyline',work,'--approve','Looks right, go ahead'])).status,'complete');
  assert.equal((await execute(['storyline',work,'--scaffold'])).status,'complete');
  const scaffolded=(await openWorkspace(work)).doc;
  assert.deepEqual(scaffolded.pages.map(p=>[p.id,p.type,p.form]),[['summary','summary','executive-summary'],['fleet','ranking','bar']]);
  assert.equal(scaffolded.deck.readerKnows,'the market basics');
  assert.equal(scaffolded.storyline.approval.words,'Looks right, go ahead');
  // A page the user did not approve reopens the storyline; so does a storyline changed after approval.
  await fs.writeFile(opened.file,JSON.stringify({...scaffolded,pages:[...scaffolded.pages,{...doc().pages[0],id:'extra'}]}));
  const drifted=await execute(['check',work]);
  assert.equal(drifted.status,'needs-input');
  assert.equal(drifted.requiredInputs[0].code,'STORYLINE_PAGES_CHANGED');
  assert.deepEqual(drifted.requiredInputs[0].added,['extra']);
  await fs.writeFile(opened.file,JSON.stringify({...scaffolded,storyline:{...scaffolded.storyline,answer:'Something else'}}));
  assert.equal((await execute(['check',work])).requiredInputs[0].kind,'storyline-approval');
});
test('check stops before the render on a full-width two-bar chart and on text a placement sets aside',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const chart=(more)=>({id:'two',type:'ranking',form:'column',title:'Model A uses a fifth less energy than Model B',
    exhibit:{heading:'Energy use',unit:'index',categories:['Model B','Model A'],series:[{name:'Energy',values:[100,80]}]},...more});
  const deck={schema:'professional-slides.deck/v3',id:'deck',contents:false,assets:{fetch:'none',reason:'test'}};
  await newWorkspace(dir,{deck,pages:[chart({commentary:'on-exhibit'})]});
  const full=await execute(['check',dir]);
  assert.equal(full.status,'blocked');assert.equal(full.stage,'compile');
  assert.deepEqual(full.findings.map(f=>f.code),['NO_COMPARISON']);
  const work=await openWorkspace(dir);
  await fs.writeFile(work.file,JSON.stringify({deck,pages:[chart({commentary:'beside',points:[{lead:'Energy is a third of running cost',text:'A fifth less energy takes about seven points off the running cost.'}]})]}));
  assert.ok(!(await execute(['check',dir])).findings.some(f=>f.code==='NO_COMPARISON'));
  await fs.writeFile(work.file,JSON.stringify({deck,pages:[{...chart({commentary:'on-exhibit'}),exhibit:{heading:'Installed base',unit:'units',categories:['Model A','Model B','Model C'],series:[{name:'Units',values:[120,240,60]}]},points:[{lead:'Set aside',text:'A point the placement does not draw.'}]}]}));
  const adjusted=await execute(['check',dir]);
  assert.equal(adjusted.status,'blocked');
  assert.ok(adjusted.findings.some(f=>f.code==='PAGE_ADJUSTED'));
});
test('a design edit cannot change a cell\'s meaning or drop a page\'s points',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const table={id:'t',type:'lookup',form:'table',title:'Two carriers lead',commentary:'in-exhibit',
    exhibit:{columns:['Carrier','Outlook'],rows:[['Atlas',{text:'Growing',tone:'positive'}],['Cargolux',{text:'Flat',tone:'neutral'}]]}};
  const work=await newWorkspace(dir,{deck:{schema:'professional-slides.deck/v3',id:'deck',contents:false},pages:[table]});
  const flipped=structuredClone(table);flipped.exhibit.rows[0][1].tone='negative';
  await assert.rejects(editWorkspace(work,{scope:'design',edits:[{page:'t',value:flipped}]}),/changes content/);
  assert.notEqual(contentSignature(flipped),contentSignature(table));
  assert.equal(contentSignature({...table,form:'measure-table',commentary:'beside'}),contentSignature(table));
});
test('an edit is refused only for what it breaks, so a PDF import is filled one page at a time',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const blank=(i)=>({id:`reference-${i}`,type:'reference',title:'',reference:'sources/reference.png',nodes:[],uncertainties:[]});
  const work=await newWorkspace(dir,{deck:{schema:'professional-slides.deck/v3',id:'deck',contents:false},pages:[blank(1),blank(2)]});
  await fs.mkdir(path.join(dir,'sources'));
  await fs.copyFile(path.resolve('skills/professional-slides/examples/assets/reference.png'),path.join(dir,'sources/reference.png'));
  const page={...referenceExample(),id:'reference-1',reference:'sources/reference.png'};
  assert.equal((await editWorkspace(work,{scope:'content',edits:[{page:'reference-1',value:page}]})).status,'needs-input');
  assert.equal((await openWorkspace(dir)).doc.pages[0].nodes.length,page.nodes.length);
});
test('an option\'s preview is found by its page in the scene, past a cover',()=>{
  const scene={slides:[{id:'cover'},{id:'one'},{id:'two-cont',sourceSlideId:'two'}]};
  assert.equal(path.basename(renderedSlide('/out',scene,'one')),'slide-2.png');
  assert.equal(path.basename(renderedSlide('/out',scene,'two')),'slide-3.png');
  assert.equal(renderedSlide('/out',scene,'missing'),null);
});
test('setup owns its own skill links, dangling or reached through a linked home, and nobody else\'s',async t=>{
  const dir=await fs.realpath(await temp());t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const base=path.join(dir,'home'),install=path.join(base,'installations','0.0.2-new'),old=path.join(base,'installations','0.0.1-old');
  for(const p of [install,old])await fs.mkdir(path.join(p,'skills/professional-slides'),{recursive:true});
  const link=(name,to)=>{const p=path.join(dir,name);return fs.symlink(to,p).then(()=>p);};
  assert.equal(await ownerOf(path.join(dir,'none'),install,base),'free');
  assert.equal(await ownerOf(await link('current',path.join(install,'skills/professional-slides')),install,base),'current');
  assert.equal(await ownerOf(await link('older',path.join(old,'skills/professional-slides')),install,base),'ours');
  const gone=path.join(base,'installations','0.0.0-deleted','skills/professional-slides');
  assert.equal(await ownerOf(await link('dangling',gone),install,base),'ours');
  await fs.mkdir(path.join(dir,'theirs'));
  assert.equal(await ownerOf(path.join(dir,'theirs'),install,base),'foreign');
  assert.equal(await ownerOf(await link('elsewhere',dir),install,base),'foreign');
  const viaLink=await link('home-link',base);
  assert.equal(await ownerOf(path.join(dir,'current'),path.join(viaLink,'installations','0.0.2-new'),viaLink),'current');
});
test('a site read reaches only public addresses',async()=>{
  for(const a of ['127.0.0.1','10.0.0.8','169.254.169.254','172.16.4.1','192.168.0.2','100.64.0.1','::1','fd12::1','fe80::1','::ffff:127.0.0.1'])assert.equal(privateAddress(a),true,a);
  for(const a of ['8.8.8.8','151.101.1.69','2606:4700::6810:84e5'])assert.equal(privateAddress(a),false,a);
  await assert.rejects(readSite('http://169.254.169.254/latest/meta-data'),/private or local/);
  await assert.rejects(readSite('file:///etc/passwd'),/http or https/);
});
test('a reconstruction keeps the imported slide it stands for, and a picture takes no outline it was not given',async()=>{
  const { compilePage } = await import('../../skills/professional-slides/runtime/page-types.mjs');
  const { registerReference } = await import('../../skills/professional-slides/runtime/reference-page.mjs');
  const page={...referenceExample(),id:'r',reference:'sources/reference.png',sourceSlide:3};
  assert.equal(compilePage(page).sourceSlide,3);
  const registry=new Map();registerReference(registry);
  const frame={x:0,y:0,width:100,height:100};
  const drawn=registry.get('reference-page').render({id:'r',props:{reference:'x.png',nodes:[{id:'pic',kind:'image',frame,src:'data:image/png;base64,AA=='},{id:'box',kind:'rect',frame}]}});
  const nodes=Array.isArray(drawn)?drawn:drawn.nodes??drawn.children??[];
  const style=(id)=>nodes.find(n=>n.id===`r-${id}`)?.style??{};
  assert.equal(style('pic').stroke,undefined);
  assert.equal(style('box').stroke.value,'#808080');
});
test('the commands that build take --no-fetch',async()=>{
  for(const name of ['build','options','style build'])assert.equal(COMMANDS[name].flags['no-fetch'].type,'boolean',name);
});
test('author-deck and build-deck hold a new argument to its approved storyline too',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const { spawnSync } = await import('node:child_process');
  const { buildDeck } = await import('../../skills/professional-slides/runtime/build-deck.mjs');
  const { readPagesFileSync, compiledFrom } = await import('../../skills/professional-slides/runtime/pages-file.mjs');
  const author=(file)=>spawnSync(process.execPath,[path.resolve('skills/professional-slides/runtime/author-deck.mjs'),file],{encoding:'utf8'});
  const one={...storyline(),sections:[{claim:'The decision is clear',pages:[{id:'one',title:'The decision is clear',type:'statement/statement',says:{shape:'highlighted',count:1}}]}]};
  const file=path.join(dir,'deck.pages.json');
  await fs.writeFile(file,JSON.stringify({...doc(),storyline:one}));
  const refused=author(file);
  assert.equal(refused.status,2);assert.match(refused.stderr,/STORYLINE_UNAPPROVED/);
  // A workspace `init` started holds its pages even with no storyline written.
  await fs.writeFile(path.join(dir,'project.json'),JSON.stringify({schema:'professional-slides.project/v1',pages:'deck.pages.json',argument:'new'}));
  await fs.writeFile(file,JSON.stringify(doc()));
  assert.match(author(file).stderr,/STORYLINE_UNAPPROVED/);
  await fs.rm(path.join(dir,'project.json'));
  // A deck.json compiled from pages whose storyline is unapproved is not built either.
  await fs.writeFile(file,JSON.stringify({...doc(),storyline:one}));
  const spec=path.join(dir,'deck.deck.json');
  await fs.writeFile(spec,JSON.stringify({schema:'professional-slides.deck/v3',id:'deck',contents:false,slides:[{id:'one',kind:'statement',title:'The decision is clear',text:'Protect the original words'}],compiledFrom:compiledFrom(readPagesFileSync(file))}));
  await assert.rejects(buildDeck(spec,path.join(dir,'out'),{render:false}),/user has not approved|STORYLINE_UNAPPROVED|approve/);
  // Pages without a storyline, outside a new workspace, compile as before.
  await fs.writeFile(file,JSON.stringify(doc()));
  assert.equal(author(file).status,0);
});
test('a research batch is filed as a part of the insight log, its measure names fixed and its sources beside it',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const prev=process.env.PROFESSIONAL_SLIDES_HOME;process.env.PROFESSIONAL_SLIDES_HOME=path.join(dir,'home');t.after(()=>{if(prev===undefined)delete process.env.PROFESSIONAL_SLIDES_HOME;else process.env.PROFESSIONAL_SLIDES_HOME=prev;});
  const work=path.join(dir,'w');
  await execute(['init',work]);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(work,'deck.insights.json'),'utf8')).insights,[],'init starts the insight log');
  const batch=path.join(dir,'fleet.json');
  await fs.writeFile(batch,JSON.stringify({sources:{wiki:{name:'Wikipedia, List of operators (Jul 2026)',status:'estimate',extra:'dropped'}},
    insights:[{id:'i-builds',finding:'Delivered by band',cite:['wiki','elsewhere'],measures:{'9X':{unit:'units',population:'Model 9X delivered',period:'2009-2026',members:['2005-2014','2015 or later'],values:[99,232]}}}]}));
  const filed=await execute(['insights',work,'--add',batch]);
  assert.equal(filed.status,'complete');
  assert.deepEqual(filed.renamed,['i-builds/9X is i-builds/m9X']);
  assert.deepEqual(filed.advisories.map(a=>a.code),['MEASURE_RENAMED','SOURCE_NOT_IN_BATCH']);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(work,'insights','fleet.sources.json'),'utf8')),{wiki:{name:'Wikipedia, List of operators (Jul 2026)',status:'estimate'}});
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(work,'deck.insights.json'),'utf8')).include,['insights/fleet.json']);
  // A batch that records an insight another batch holds is refused, and the log is left as it was.
  const again=path.join(dir,'again.json');
  await fs.writeFile(again,JSON.stringify({sources:{},insights:[{id:'i-builds',finding:'x',measures:{n:{unit:'units',population:'p',period:'2026',value:1}}}]}));
  assert.equal((await execute(['insights',work,'--add',again])).status,'blocked');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(work,'deck.insights.json'),'utf8')).include,['insights/fleet.json']);
  assert.equal((await execute(['catalog','--type','sources','--schema'])).schemaDefinition.additionalProperties.required[0],'name');
});
test('a deck that draws a contents page is scaffolded with a divider a named section',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const prev=process.env.PROFESSIONAL_SLIDES_HOME;process.env.PROFESSIONAL_SLIDES_HOME=path.join(dir,'home');t.after(()=>{if(prev===undefined)delete process.env.PROFESSIONAL_SLIDES_HOME;else process.env.PROFESSIONAL_SLIDES_HOME=prev;});
  const work=path.join(dir,'w');
  await execute(['init',work]);
  const opened=await openWorkspace(work);
  const base=storyline();
  const section=(name,id)=>({...base.sections[1],name,pages:base.sections[1].pages.map(p=>({...p,id}))});
  await fs.writeFile(opened.file,JSON.stringify({...opened.doc,deck:{...opened.doc.deck,contents:'once'},storyline:{...base,sections:[base.sections[0],section('Fleet','fleet'),section('Orders','orders')]}}));
  assert.equal((await execute(['storyline',work,'--approve','Yes'])).status,'complete');
  await execute(['storyline',work,'--scaffold']);
  const pages=(await openWorkspace(work)).doc.pages;
  assert.deepEqual(pages.map(p=>p.kind?`${p.kind}:${p.title}`:p.id),['summary','section:Fleet','fleet','section:Orders','orders']);
});
test('the storyline count says when the pages file holds fewer dividers than it counts',async t=>{
  // The A350F deck was scaffolded before the scaffold wrote dividers: counted at 122 pages with none written, it built 101.
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const prev=process.env.PROFESSIONAL_SLIDES_HOME;process.env.PROFESSIONAL_SLIDES_HOME=path.join(dir,'home');t.after(()=>{if(prev===undefined)delete process.env.PROFESSIONAL_SLIDES_HOME;else process.env.PROFESSIONAL_SLIDES_HOME=prev;});
  const work=path.join(dir,'w');
  await execute(['init',work]);
  const opened=await openWorkspace(work);
  const base=storyline();
  const section=(name,id)=>({...base.sections[1],name,pages:base.sections[1].pages.map(p=>({...p,id}))});
  await fs.writeFile(opened.file,JSON.stringify({...opened.doc,deck:{...opened.doc.deck,contents:'once'},storyline:{...base,sections:[base.sections[0],section('Fleet','fleet'),section('Orders','orders')]}}));
  const shown=async()=>{const result=await execute(['storyline',work]);return result.storyline??result.requiredInputs[0].message;};
  const counted='a contents page and 2 section dividers: 7 pages in all';
  // Before any page is written, the scaffold writes them all.
  assert.ok((await shown()).includes(counted));
  assert.ok(!(await shown()).includes('The pages file holds'));
  await execute(['storyline',work,'--approve','Yes']);
  await execute(['storyline',work,'--scaffold']);
  const scaffolded=(await openWorkspace(work)).doc;
  await fs.writeFile(opened.file,JSON.stringify({...scaffolded,pages:scaffolded.pages.filter(p=>p.kind!=='section')}));
  assert.ok((await shown()).includes(`${counted}, 8 if the deck carries photographs (a credits page). The pages file holds none of the 2 section dividers yet: \`storyline WORK --scaffold\` writes them; until then the build draws only the dividers the pages file holds.`));
  await fs.writeFile(opened.file,JSON.stringify({...scaffolded,pages:scaffolded.pages.filter(p=>p.id!=='section-2')}));
  assert.ok((await shown()).includes('The pages file holds 1 of the 2 section dividers: `storyline WORK --scaffold` writes the other 1;'));
  await execute(['storyline',work,'--scaffold']);
  assert.equal((await openWorkspace(work)).doc.pages.filter(p=>p.kind==='section').length,2);
  assert.ok((await shown()).includes(counted));
  assert.ok(!(await shown()).includes('The pages file holds'));
});
test('the picture libraries report which have a key, and never the key',async t=>{
  const dir=await temp();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const prev=process.env.PROFESSIONAL_SLIDES_HOME;process.env.PROFESSIONAL_SLIDES_HOME=path.join(dir,'home');t.after(()=>{if(prev===undefined)delete process.env.PROFESSIONAL_SLIDES_HOME;else process.env.PROFESSIONAL_SLIDES_HOME=prev;});
  const shown=await execute(['keys','--json']);
  assert.deepEqual(Object.keys(shown.pictureKeys),['pexels','unsplash','pixabay']);
  assert.ok(!JSON.stringify(shown).includes('KEY='));
});

test('the storyline message counts the pages the build adds, marks pages whose data is unchecked and names a skipped candidate',()=>{
  const plan={question:'How large is the market?',answer:'Large enough to enter',alternative:'10 pages',
    reader:{audience:'executives',readerKnows:'the sector',decision:'whether to enter',density:'executive'},
    sections:[{role:'opening',pages:[{id:'exec',title:'Executive summary',type:'summary/executive-summary',says:{shape:'lead-text',count:5,of:'statements'}}]},
      {role:'finding',name:'Demand',claim:'Demand is large',pages:[
        {id:'forecast',title:'Demand doubles by 2035',type:'composition/stacked-bar',compares:'demand by segment',members:3,series:2,candidates:['composition/stacked-bar'],data:{status:'found',what:'a forecast'},says:{shape:'callouts',count:2}},
        {id:'pair',title:'Product A costs 20% less',type:'ranking/bar',compares:'two products',members:2,candidates:['ranking/bar'],data:{status:'to-find',what:'claims'},says:{shape:'lead-bullets',count:2,of:'reasons'}}]},
      {role:'finding',name:'Traction',claim:'Customers choose it',pages:[
        {id:'orders',title:'Orders by year',type:'trend/line',compares:'orders by year',members:6,candidates:['trend/stacked-column','trend/line'],data:{status:'to-find',what:'order book'},says:{shape:'lead-text',count:3,of:'drivers'}}]},
      {role:'appendix',pages:[{id:'glossary',title:'Glossary',type:'lookup/table',compares:'terms',data:{status:'found',what:'definitions'},says:{shape:'none'}}]}]};
  const withContents=approvalMessage(plan,{contents:'once'}),without=approvalMessage(plan,{contents:false});
  assert.ok(withContents.includes('The build adds the cover, a contents page, 2 section dividers and an appendix divider: 10 pages in all, 11 if the deck carries photographs'));
  assert.ok(without.includes('The build adds the cover and an appendix divider: 7 pages in all'));
  assert.match(withContents,/\n\s+3\* Product A costs 20% less/);
  assert.ok(withContents.includes('not its first candidate, trend/stacked-column'));
  assert.ok(withContents.includes('* The data behind this page is still to find'));
  assert.deepEqual(shortPages(plan).map(f=>f.id),['pair']);
  // Each page's planned words on its line, and the deck's shapes and counts in one line, where a storyline of one shape shows.
  assert.match(withContents,/Product A costs 20% less\n\s+ranking\/bar · 2 members · data to-find · words: 2 × title over bullets \(reasons\)/);
  assert.ok(withContents.includes('Words: title over its sentence 2 · callouts on the exhibit 1 · title over bullets 1 · the exhibit alone 1. Groups a page: 2 (1 page) · 3 (1 page) · 5+ (1 page).'));
  const unplanned={...plan,sections:plan.sections.map(s=>({...s,pages:s.pages.map(({says,...p})=>p)}))};
  assert.ok(storylineProblems(unplanned).some(p=>p.includes('`says` plans the page\'s words')));
  assert.ok(storylineProblems({...plan,sections:[plan.sections[0],{...plan.sections[1],pages:[{...plan.sections[1].pages[1],says:{shape:'rows'}}]}]}).some(p=>p.includes('`says.count` is how many items')));
});

test('a storyline that plans one point style or one count on most of its pages is advised there, and a varied one is not',()=>{
  const page=(id,says)=>({id,title:`Page ${id}`,type:'statement/statement',says});
  const plan=(says)=>({sections:[{claim:'c',pages:says.map((s,i)=>page(`p${i}`,s))}]});
  const same=uniformWords(plan(Array.from({length:7},()=>({shape:'lead-text',count:3}))));
  assert.deepEqual(same.map(a=>a.code),['STORYLINE_WORDS_UNIFORM','STORYLINE_WORDS_UNIFORM']);
  assert.match(same[0].repair,/7 of 7 pages with points plan them as title over its sentence/);
  assert.match(same[1].repair,/7 of 7 pages plan 3 groups of words/);
  const varied=[{shape:'lead-text',count:2},{shape:'lead-inline',count:4},{shape:'highlighted',count:3},{shape:'lead-bullets',count:2},{shape:'lead-text',count:5},{shape:'lead-inline',count:3},{shape:'rows',count:6}];
  assert.deepEqual(uniformWords(plan(varied)),[]);
});

test('a long storyline that plans almost no pictures is advised there, and one that plans them is not',()=>{
  const plan=(types)=>({sections:[{claim:'c',pages:types.map((type,i)=>({id:`p${i}`,title:`Page ${i}`,type}))}]});
  const bare=fewPictures(plan(Array.from({length:30},()=>'ranking/bar')));
  assert.deepEqual(bare.map(a=>a.code),['STORYLINE_PICTURES_FEW']);
  assert.match(bare[0].repair,/0 of 30 pages plan a picture: where the subject can be seen, plan about 2/);
  assert.deepEqual(fewPictures(plan([...Array.from({length:28},()=>'ranking/bar'),'picture/picture-hero','picture/picture-strip'])),[]);
  assert.deepEqual(fewPictures(plan(Array.from({length:8},()=>'ranking/bar'))),[]);
});

const variedDeck=(pages)=>{
  const {spec}=compileDeck({deck:{schema:'professional-slides.deck/v3',id:'d',contents:false,variation:'f0097b1a',assets:{fetch:'none',reason:'test'}},pages},{partial:true});
  return composeAll(spec).deck.slides;
};

test('led findings with no points style vary page by page, and an author\'s style stands',()=>{
  const page=(id,extra={})=>({id,type:'ranking',form:'bar',title:'Alpha leads the field on the measures that matter',commentary:'below',source:'Source: test',...extra,
    exhibit:{heading:'Share of routes',unit:'%',categories:['Alpha','Bravo','Charlie','Delta','Echo'],series:[{name:'Share',values:[23.4,21.5,7.4,4.1,1.9]}]},
    points:[{lead:'Cost',text:'Alpha has the lowest fare on four routes in five and has hedged its fuel to the end of the decade.'},
      {lead:'Hubs',text:'Bravo holds slots at three hubs in four and a loyalty base twice the size of Alpha\'s.'}]});
  const look=(slide)=>{
    const texts=slide.nodes.filter(n=>typeof n.text==='string').map(n=>n.text.replace(/\n/g,' '));
    return texts.some(t=>t.startsWith('Cost: Alpha'))?'inline':slide.nodes.some(n=>n.role==='section-surface')?'boxed':'prose';
  };
  const looks=variedDeck(['a','b','c','d'].map(id=>page(id))).map(look);
  assert.equal(new Set(looks.slice(0,3)).size,3,`three pages take three styles: ${looks}`);
  looks.slice(1).forEach((one,at)=>assert.notEqual(one,looks[at],`no two pages in a row share a style: ${looks}`));
  assert.deepEqual(variedDeck(['a','b','c'].map(id=>page(id,{pointsStyle:'inline'}))).map(look),['inline','inline','inline']);
});

test('untreated tables vary their header, label column and rows page by page; a written treatment stands',()=>{
  const rows=[['Alpha','Lowest fare on four routes in five','Holds its share'],['Bravo','Slots at three hubs in four','Defends the hubs'],['Charlie','A new fleet from 2027','Grows on cost'],['Delta','Exits two routes','Shrinks']];
  const page=(id,extra={})=>({id,type:'lookup',form:'table',title:'Each carrier plays to a different strength',commentary:'none',source:'Source: test',exhibit:{columns:['Carrier','Position','Outlook'],rows,...extra}});
  const chrome=(slide)=>{
    const roles=new Set(slide.nodes.map(n=>n.role));
    return `${roles.has('table-label-column')?'labels':'-'}/${slide.nodes.some(n=>n.role==='table-zebra-band')?'zebra':'rules'}/${slide.nodes.some(n=>/table-header/.test(String(n.role))&&n.type==='rect')?'band':'rule'}`;
  };
  const varied=variedDeck(['a','b','c'].map(id=>page(id))).map(chrome);
  assert.equal(new Set(varied).size,3,`three tables take three looks: ${varied}`);
  const written=variedDeck(['a','b','c'].map(id=>page(id,{treatment:'open'}))).map(chrome);
  assert.equal(new Set(written).size,1,`a written treatment keeps the house's chrome: ${written}`);
});

test('a dated timeline over its commentary is staggered across the page, its points at the foot',()=>{
  const items=['Jan 2023','Nov 2025','May 2026','Sep 2026','Jan 2028','2029'].map((date,i)=>({date,label:`Milestone ${i+1}`,text:`What happens at milestone ${i+1}, in one sentence.`}));
  const [slide]=variedDeck([{id:'t',type:'schedule',form:'timeline',commentary:'below',title:'Six dates bound the opening',source:'Source: test',exhibit:{items},
    points:[{lead:'A window',text:'The entry is guided for the second half of 2027.'},{lead:'A bridge',text:'Existing aircraft keep flying through the gap.'}]}]);
  const markers=slide.nodes.filter(n=>n.role==='timeline-marker');
  assert.equal(markers.length,6);
  assert.equal(new Set(markers.map(n=>Math.round(n.frame.y))).size,1,'the markers sit on one rail across the page');
  const rail=markers[0].frame.y;
  const labels=slide.nodes.filter(n=>n.role==='timeline-label');
  assert.ok(labels.filter((n,i)=>i%2===0).every(n=>n.frame.y<rail)&&labels.filter((n,i)=>i%2===1).every(n=>n.frame.y>rail),'stages alternate above and below the rail');
  assert.equal(slide.nodes.filter(n=>n.role==='timeline-stem').length,6);
  const lead=slide.nodes.find(n=>typeof n.text==='string'&&n.text.includes('A window'));
  assert.ok(lead.frame.y>Math.max(...labels.map(n=>n.frame.y)),'the points sit under the schedule');
});

test('a point can carry short bullets under its lead, beside a chart or under it',()=>{
  const page=(commentary)=>({id:'p',type:'ranking',form:'bar',title:'Alpha leads the field on the measures that matter',commentary,source:'Source: test',
    exhibit:{heading:'Share of routes',unit:'%',categories:['Alpha','Bravo','Charlie','Delta','Echo'],series:[{name:'Share',values:[23.4,21.5,7.4,4.1,1.9]}]},
    points:[{lead:'Alpha wins on cost',points:['Lowest fare on four routes in five','Fuel hedged to the end of the decade']},{lead:'Bravo holds the hubs',points:['Slots at three hubs in four','A loyalty base twice the size of Alpha\'s']}]});
  for(const commentary of ['beside','below']){
    const {spec}=compileDeck({deck:{schema:'professional-slides.deck/v3',id:'d',contents:false,assets:{fetch:'none',reason:'test'}},pages:[page(commentary)]},{partial:true});
    const texts=composeAll(spec).deck.slides[0].nodes.map(n=>n.text).filter(Boolean);
    for(const line of ['Alpha wins on cost','Lowest fare on four routes in five','Fuel hedged to the end of the decade','Bravo holds the hubs','A loyalty base twice the size of Alpha\'s'])
      assert.ok(texts.includes(line),`${commentary}: "${line}" is drawn`);
  }
});

test('a point can run its bold lead into its sentence after a colon, and a bullet can carry a lead of its own',()=>{
  const page=(commentary)=>({id:'p',type:'ranking',form:'bar',title:'Alpha leads the field on the measures that matter',commentary,source:'Source: test',pointsStyle:'inline',
    exhibit:{heading:'Share of routes',unit:'%',categories:['Alpha','Bravo','Charlie','Delta','Echo'],series:[{name:'Share',values:[23.4,21.5,7.4,4.1,1.9]}]},
    points:[{lead:'Cost',text:'Alpha has the lowest fare on four routes in five and has hedged its fuel to the end of the decade.'},
      {lead:'Hubs',text:'Bravo holds slots at three hubs in four and a loyalty base twice the size of Alpha\'s.'}]});
  for(const commentary of ['beside','below']){
    const {spec}=compileDeck({deck:{schema:'professional-slides.deck/v3',id:'d',contents:false,assets:{fetch:'none',reason:'test'}},pages:[page(commentary)]},{partial:true});
    const nodes=composeAll(spec).deck.slides[0].nodes;
    const node=nodes.find(n=>typeof n.text==='string'&&n.text.replace(/\n/g,' ').startsWith('Cost: Alpha has the lowest fare'));
    assert.ok(node,`${commentary}: the lead runs into its sentence after a colon`);
    assert.ok(node.runs?.some(r=>r.bold&&/^Cost:/.test(r.text)),`${commentary}: the lead is bold`);
    assert.ok(node.runs?.some(r=>!r.bold&&r.text.startsWith('Alpha has')),`${commentary}: its sentence is not`);
  }
  const bullets={id:'q',type:'ranking',form:'bar',title:'Alpha leads the field on the measures that matter',commentary:'beside',source:'Source: test',
    exhibit:{heading:'Share of routes',unit:'%',categories:['Alpha','Bravo','Charlie','Delta','Echo'],series:[{name:'Share',values:[23.4,21.5,7.4,4.1,1.9]}]},
    points:[{lead:'Alpha wins on cost',points:[{lead:'Fares',text:'the lowest on four routes in five'},'Fuel hedged to the end of the decade']},{lead:'Bravo holds the hubs',points:['Slots at three hubs in four','A loyalty base twice Alpha\'s']}]};
  const {spec}=compileDeck({deck:{schema:'professional-slides.deck/v3',id:'d',contents:false,assets:{fetch:'none',reason:'test'}},pages:[bullets]},{partial:true});
  const sub=composeAll(spec).deck.slides[0].nodes.find(n=>n.role==='list-subitem'&&n.text.replace(/\n/g,' ').startsWith('Fares: the lowest'));
  assert.ok(sub&&sub.runs?.some(r=>r.bold&&r.text.startsWith('Fares:')),'a bullet\'s own lead is bold before its colon');
});

test('advisories put a changed title first and merge untraced numbers into one line',()=>{
  const out=rankedAdvisories([{code:'NUMBER_UNTRACED',id:'a'},{code:'SCENE_DENSE',id:'b'},{code:'NUMBER_UNTRACED',id:'c'},{code:'NUMBERS_DISAGREE',id:'d'},{code:'STORYLINE_TITLE_CHANGED',id:'e'}]);
  assert.deepEqual(out.map(f=>f.code),['STORYLINE_TITLE_CHANGED','NUMBERS_DISAGREE','SCENE_DENSE','NUMBER_UNTRACED']);
  assert.deepEqual(out.at(-1).pages,['a','c']);
});
