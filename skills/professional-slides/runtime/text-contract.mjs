// The dot-dash's visible copy is the source of truth through composition/export.
const roles = new Set(['title', 'body', 'exhibit', 'qualification', 'source', 'furniture']);
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
    const median = quantile(ref.samples.map(s=>s.bodyWords),.5), floor = quantile(ref.samples.map(s=>s.bodyWords),.25);
    const score = {id:page.id,page:page.n,task:ref.task,bodyWords,totalWords,referenceBodyMedian:median,referenceBodyLowerQuartile:floor,referenceTotalMedian:quantile(ref.samples.map(s=>s.totalWords),.5),textCoverageScore:median ? Math.round(bodyWords/median*100) : null,explanation:ref.rationale || null};
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
  }
  return {...check,accepted:!findings.some(f=>f.severity==='blocking'),findings};
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
