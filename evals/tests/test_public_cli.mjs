import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execute, COMMANDS } from '../../skills/professional-slides/runtime/command.mjs';
import { newWorkspace, editWorkspace, openWorkspace, fingerprint, digest, contentSignature, renderedSlide, rankedAdvisories } from '../../skills/professional-slides/runtime/public/workspace.mjs';
import { approvalMessage, shortPages } from '../../skills/professional-slides/runtime/public/storyline.mjs';
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
  sections:[{role:'opening',pages:[{id:'summary',title:'Executive summary',type:'summary/executive-summary'}]},
    {claim:'The installed base must be replaced',pages:[{id:'fleet',title:'Older units are ageing out',type:'ranking/bar',compares:'seven types by age',members:7,
      candidates:['ranking/bar','lookup/table'],data:{status:'to-find',what:'installed base by type and build year'}}]}],
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
  const one={...storyline(),sections:[{claim:'The decision is clear',pages:[{id:'one',title:'The decision is clear',type:'statement/statement'}]}]};
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
    sections:[{role:'opening',pages:[{id:'exec',title:'Executive summary',type:'summary/executive-summary'}]},
      {role:'finding',name:'Demand',claim:'Demand is large',pages:[
        {id:'forecast',title:'Demand doubles by 2035',type:'composition/stacked-bar',compares:'demand by segment',members:3,series:2,candidates:['composition/stacked-bar'],data:{status:'found',what:'a forecast'}},
        {id:'pair',title:'Product A costs 20% less',type:'ranking/bar',compares:'two products',members:2,candidates:['ranking/bar'],data:{status:'to-find',what:'claims'}}]},
      {role:'finding',name:'Traction',claim:'Customers choose it',pages:[
        {id:'orders',title:'Orders by year',type:'trend/line',compares:'orders by year',members:6,candidates:['trend/stacked-column','trend/line'],data:{status:'to-find',what:'order book'}}]},
      {role:'appendix',pages:[{id:'glossary',title:'Glossary',type:'lookup/table',compares:'terms',data:{status:'found',what:'definitions'}}]}]};
  const withContents=approvalMessage(plan,{contents:'once'}),without=approvalMessage(plan,{contents:false});
  assert.ok(withContents.includes('The build adds the cover, a contents page, 2 section dividers and an appendix divider: 10 pages in all, 11 if the deck carries photographs'));
  assert.ok(without.includes('The build adds the cover and an appendix divider: 7 pages in all'));
  assert.match(withContents,/\n\s+3\* Product A costs 20% less/);
  assert.ok(withContents.includes('not its first candidate, trend/stacked-column'));
  assert.ok(withContents.includes('* The data behind this page is still to find'));
  assert.deepEqual(shortPages(plan).map(f=>f.id),['pair']);
});

test('advisories put a changed title first and merge untraced numbers into one line',()=>{
  const out=rankedAdvisories([{code:'NUMBER_UNTRACED',id:'a'},{code:'SCENE_DENSE',id:'b'},{code:'NUMBER_UNTRACED',id:'c'},{code:'NUMBERS_DISAGREE',id:'d'},{code:'STORYLINE_TITLE_CHANGED',id:'e'}]);
  assert.deepEqual(out.map(f=>f.code),['STORYLINE_TITLE_CHANGED','NUMBERS_DISAGREE','SCENE_DENSE','NUMBER_UNTRACED']);
  assert.deepEqual(out.at(-1).pages,['a','c']);
});
