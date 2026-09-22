// The dot-dash's visible copy is the source of truth through composition/export.
import { readFileSync } from 'node:fs';

const roles = new Set(['title', 'body', 'exhibit', 'qualification', 'source', 'furniture']);

// How long a single run of prose may be, measured rather than chosen.
//
// The word-count contract asks whether a page says enough. It does not ask what
// shape the words are in, and a deck answered every page with one 150-to-200
// word paragraph, passed, and read as an essay with pictures. Over 37 analytic
// pages of client-project decks the median page carries four text blocks of
// about 56 words, and three pages in four keep every block under 152. That
// number is the cap here: past it, the page is asking the reader to take a
// wall of prose in one go, and the fix is two or three developed points rather
// than a shorter sentence.
const CONTRACT = JSON.parse(readFileSync(new URL('./weight.json', import.meta.url), 'utf8'));
export const TEXT_FORM = CONTRACT.plan.textForm;
export const normalizeText = value => String(value ?? '').normalize('NFKC').replace(/[\u00ad\u200b]/g, '').replace(/-\s*\r?\n\s*/g, '-').replace(/\s+/g, ' ').trim();
export const textWords = value => normalizeText(value).split(/\s+/).filter(Boolean).length;
const resolvePages = (value, scene) => String(value).replace(/\{\{page:([^}]+)\}\}/g, (_, id) => {
  const numbers = scene.slides.flatMap((s,i)=>s.id===id || s.sourceSlideId===id ? [i+1] : []);
  return numbers.length ? numbers.length>1 ? `${numbers[0]}–${numbers.at(-1)}` : String(numbers[0]) : `{{page:${id}}}`;
});
const quantile = (values, q) => { const a = [...values].sort((x,y)=>x-y), i = (a.length-1)*q; return a.length ? a[Math.floor(i)] + (a[Math.ceil(i)]-a[Math.floor(i)])*(i%1) : null; };
export function checkTextPlan(content, {required = false} = {}) {
  const enabled = required || content?.textContract === 'complete';
  const findings = [], scores = [];
  if (!enabled) return {accepted:true, state:'legacy-unverified', findings, scores};
  for (const page of content.pages || []) {
    const fail = (code, reason) => findings.push({page:page.n, id:page.id, code, reason, severity:'blocking'});
    const blocks = page.textPlan;
    if (!Array.isArray(blocks) || !blocks.length || blocks.some(b=>!b.id || !roles.has(b.role) || typeof b.text !== 'string' || !b.text.trim()) || new Set(blocks.map(b=>b.id)).size !== blocks.length) {
      fail('TEXT_PLAN_INCOMPLETE','List every visible text block with a unique id, role and final wording.'); continue;
    }
    const bodyWords = blocks.filter(b=>['body','exhibit','qualification'].includes(b.role)).reduce((n,b)=>n+textWords(b.text),0);
    const totalWords = blocks.filter(b=>b.role!=='furniture' && b.role!=='source').reduce((n,b)=>n+textWords(b.text),0);
    const ref = page.textReference;
    if (!ref?.task || !Array.isArray(ref.samples) || !ref.samples.length || ref.samples.some(s=>!s.reference || !Number.isInteger(s.page) || s.page<1 || !Number.isFinite(s.bodyWords) || s.bodyWords<0 || !Number.isFinite(s.totalWords) || s.totalWords<s.bodyWords || !s.sha256)) {
      fail('TEXT_REFERENCE_MISSING','Supply measured, inspected reference pages serving this reading task, including source hash and body/total word counts.'); continue;
    }
    // Form, not just volume: the longest single run of prose on the page, and
    // how many runs there are. Exhibit cells and furniture are not prose.
    const prose = blocks.filter(b=>['body','qualification'].includes(b.role)).map(b=>textWords(b.text));
    const longest = prose.length ? Math.max(...prose) : 0;
    if (longest > TEXT_FORM.longestBlockMax) {
      fail('TEXT_BLOCK_TOO_LONG',
        `One run of ${longest} words; client decks keep every block under ${TEXT_FORM.longestBlockMax} `
        + `(median block ${TEXT_FORM.wordsPerBlock.median} words, median page ${TEXT_FORM.blocksPerPage.median} blocks). `
        + 'Split it into two or three points that each make their own claim, rather than shortening the sentence.');
    }
    const median = quantile(ref.samples.map(s=>s.bodyWords),.5), floor = quantile(ref.samples.map(s=>s.bodyWords),.25);
    const score = {id:page.id,page:page.n,task:ref.task,bodyWords,totalWords,proseBlocks:prose.length,longestBlock:longest,referenceBodyMedian:median,referenceBodyLowerQuartile:floor,referenceTotalMedian:quantile(ref.samples.map(s=>s.totalWords),.5),textCoverageScore:median ? Math.round(bodyWords/median*100) : null,explanation:ref.rationale || null};
    scores.push(score);
    if (bodyWords<floor) {
      if (!ref.rationale?.trim()) fail('TEXT_COVERAGE_LOW',`Planned body has ${bodyWords} words; comparable reference lower quartile is ${floor}. Develop the missing explanation or document why this page's complete argument needs less text for editorial review.`);
      else findings.push({page:page.n,id:page.id,code:'TEXT_COVERAGE_EXCEPTION',reason:ref.rationale,severity:'advisory'});
    }
  }
  return {accepted:!findings.some(f=>f.severity==='blocking'),state:'checked',findings,scores};
}

export function auditTextPlan(content, scene) {
  const check = checkTextPlan(content);
  if (check.state !== 'checked') return check;
  const findings = [...check.findings];
  const plannedIds = new Set((content.pages || []).map(p=>p.id));
  for (const slide of scene.slides) if (!plannedIds.has(slide.id)) findings.push({id:slide.id,code:'TEXT_PAGE_UNPLANNED',severity:'blocking'});
  for (const page of content.pages || []) {
    const actual = scene.slides.filter(s=>s.id===page.id || s.sourceSlideId===page.id);
    if (!actual.length) { findings.push({id:page.id,code:'TEXT_PAGE_MISSING',severity:'blocking'}); continue; }
    if (actual.length!==1 || actual[0].id!==page.id) { findings.push({id:page.id,code:'TEXT_PLAN_PAGINATION',pages:actual.map(s=>s.id),reason:'Reconcile split pages into individual dot-dash text plans and reference comparisons before export.',severity:'blocking'}); continue; }
    // Whitespace wrapping is immaterial; wording and repeated occurrences are not.
    let text = normalizeText(actual.flatMap(s=>s.nodes.filter(n=>n.type==='text').map(n=>n.data?.textLayout?.source ?? n.text)).join(' '));
    for (const block of [...(page.textPlan || [])].sort((a,b)=>b.text.length-a.text.length)) {
      const needle = normalizeText(resolvePages(block.text,scene)), at = text.indexOf(needle);
      if (at<0) findings.push({id:page.id,block:block.id,code:'TEXT_PLAN_LOST',text:block.text,severity:'blocking'});
      else if (at>=0) text = text.slice(0,at)+' '+text.slice(at+needle.length);
    }
    if (!findings.some(f=>f.id===page.id && f.severity==='blocking') && /[\p{L}\p{N}]/u.test(text)) findings.push({id:page.id,code:'TEXT_UNPLANNED',text:normalizeText(text),severity:'blocking'});
    const mismatch = readingTaskMismatch(page.textReference?.task, actual[0]);
    if (mismatch) findings.push({id:page.id,code:'TEXT_TASK_MISMATCH',...mismatch,severity:'blocking'});
  }
  return {...check,accepted:!findings.some(f=>f.severity==='blocking'),findings};
}

// Whether the page the reference is compared against reads the way this one does.
//
// The word floor is only as honest as the references it is drawn from. Client
// chart pages carry a commentary column 38% of the time; the rest are a
// full-width exhibit with a line of takeaway, and they run to about 90 body
// words rather than 150. A deck measured every one of its full-width pages
// against pages that had a commentary column, reached the floor the only way it
// could - a takeaway band four lines deep - and passed. The reverse is the
// loophole storylining already names: a page with a commentary column claiming
// the lighter exhibit-led floor is choosing sparse references to lower the bar.
// Both are the same mistake, and the composed page settles which one it is.
export const READING_TASKS = Object.freeze({
  'exhibit-with-commentary': {commentary: true},
  'exhibit-led': {commentary: false},
});
const COMMENTARY_ROLES = new Set(['list-item', 'list-lead', 'paragraph']);
export function readingTaskMismatch(task, slide) {
  const rule = READING_TASKS[task];
  if (!rule || !slide) return null;
  const commentary = (slide.nodes || []).some(n => n.type === 'text' && COMMENTARY_ROLES.has(String(n.role || '')));
  if (commentary === rule.commentary) return null;
  return rule.commentary
    ? {task, commentary, reason: 'This page has no commentary column, so its reading task is exhibit-led: a full-width exhibit with a line of takeaway. Measured against pages with a commentary column, it can only reach the floor by padding its takeaway band. Measure exhibit-led references and use those.'}
    : {task, commentary, reason: 'This page has a commentary column, so exhibit-led references understate what it should carry. Measure pages that pair an exhibit with commentary.'};
}

export function auditExportText(content, scene, pageTexts) {
  const check = checkTextPlan(content);
  if (check.state !== 'checked') return check;
  const findings = [...check.findings];
  if (pageTexts.length !== scene.slides.length) findings.push({code:'TEXT_EXPORT_PAGE_COUNT',severity:'blocking'});
  for (const page of content.pages || []) {
    const texts = scene.slides.flatMap((s,i)=>s.id===page.id || s.sourceSlideId===page.id ? [pageTexts[i] || ''] : []);
    if (texts.length!==1) { findings.push({id:page.id,code:'TEXT_PLAN_PAGINATION',severity:'blocking'}); continue; }
    // PDF text can have different reading order. Check each planned fragment,
    // and count repeated fragments, without requiring node order to persist.
    let actual = normalizeText(texts.join(' '));
    for (const block of [...(page.textPlan || [])].sort((a,b)=>b.text.length-a.text.length)) {
      const needle = normalizeText(resolvePages(block.text,scene)), at = actual.indexOf(needle);
      if (at<0) findings.push({id:page.id,block:block.id,code:'TEXT_EXPORT_LOST',text:block.text,severity:'blocking'});
      else actual = actual.slice(0,at)+' '+actual.slice(at+needle.length);
    }
    if (!findings.some(f=>f.id===page.id && f.severity==='blocking') && /[\p{L}\p{N}]/u.test(actual)) findings.push({id:page.id,code:'TEXT_EXPORT_UNPLANNED',text:normalizeText(actual),severity:'blocking'});
  }
  return {...check,stage:'saved-pdf',accepted:!findings.some(f=>f.severity==='blocking'),findings};
}
