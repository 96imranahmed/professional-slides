// The dot-dash's visible copy is the source of truth through composition/export.
import { readJsonSync } from "./cli.mjs";
import { registered } from "./errors.mjs";
import { GENERATED, PICTURE_SHARE_MAX, PLAN, applyRulesVersion } from "./weight.mjs";

const roles = new Set(['title', 'body', 'exhibit', 'qualification', 'source', 'furniture']);

// How long a single run of prose may be.
//
// The word-count contract asks whether a page says enough. It does not ask what
// shape the words are in, and a deck that answers every page with one
// 150-to-200 word paragraph passes it and reads as an essay with pictures. A
// typical well-made analytic page carries four text blocks of about 56 words,
// and three pages in four keep every block under 152. That number is the cap
// here: past it, the page is asking the reader to take a wall of prose in one
// go, and the fix is two or three developed points rather than a shorter
// sentence.
export const TEXT_FORM = PLAN.textForm;

// What the audits of the planned text against the composed scene and the
// saved file can find (auditTextPlan, auditExportText); every one blocks.
export const TEXT_CONTRACT_CODES = Object.freeze({
  TEXT_PAGE_UNPLANNED: "a composed page the text plan does not list",
  TEXT_PAGE_MISSING: "a planned page that no composed page carries",
  TEXT_PLAN_PAGINATION: "a planned page split across several composed or saved pages",
  TEXT_PLAN_LOST: "a planned block of text missing from its composed page",
  TEXT_UNPLANNED: "text on a composed page that the plan never wrote",
  TEXT_EXPORT_PAGE_COUNT: "the saved file has a different number of pages than the scene",
  TEXT_EXPORT_LOST: "a planned block of text missing from its saved page",
  TEXT_EXPORT_UNPLANNED: "text on a saved page that the plan never wrote",
});
export const normalizeText = value => String(value ?? '').normalize('NFKC').replace(/[\u00ad\u200b]/g, '').replace(/-\s*\r?\n\s*/g, '-').replace(/\s+/g, ' ').trim();
// Lines the counting rule excludes, matching how the shipped task targets count.
const NOTE_LINE = /^\s*(source|sources|note|notes|footnote)\b[:\s]/i;
// The one definition of a word (gates/text_stats.py ports it): the normalised
// text split on whitespace, every token a word.
export const textWordList = value => { const text = normalizeText(value); return text ? text.split(' ') : []; };
export const textWords = value => textWordList(value).length;
const resolvePages = (value, scene) => String(value).replace(/\{\{page:([^}]+)\}\}/g, (_, id) => {
  const numbers = scene.slides.flatMap((s,i)=>s.id===id || s.sourceSlideId===id ? [i+1] : []);
  return numbers.length ? numbers.length>1 ? `${numbers[0]}–${numbers.at(-1)}` : String(numbers[0]) : `{{page:${id}}}`;
});
// Text the runtime writes rather than the author: axis ticks, page numbers,
// tracker and contents labels, numbering, the deck footer, legend values. It
// is checked by the runtime's own gates; the text plan need not list it, and
// the audits subtract it after matching what the plan does list.
export const GENERATED_ROLES = /^(page-number|axis-label|tracker-|agenda-marker-label|table-section-number|table-row-number|footer-(left|right)|divider-number|divider-contents|map-size-legend-label)/;
// Pages the runtime inserts: the contents pages, the appendix divider, the picture credits and the sources' declared limits.
export const GENERATED_PAGE = new RegExp(`^(agenda-\\d+|appendix-divider)$|${GENERATED.source}`);
// A structural page (cover, divider, contents, statement, takeaways) keeps its
// text checks but is not an analytical page, so no reading-task floor applies.
const STRUCTURAL_KINDS = new Set(['cover', 'section', 'divider', 'agenda', 'statement', 'takeaways']);
const structural = page => page.role === 'structural' || STRUCTURAL_KINDS.has(page.kind);
// Where a planned block occurs in the page text. A short or numeric block ("4",
// "18") matches only as a whole token: found as a substring it took the "4" out
// of "04 / The rivals are real" and left the rest reported as unplanned.
export function locate(text, needle) {
  if (needle.length > 4 && !/^[\d.,%\s]+$/.test(needle)) { const at = text.indexOf(needle); return { at, length: needle.length }; }
  const match = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "u").exec(text);
  return match ? { at: match.index + match[1].length, length: needle.length } : { at: -1, length: 0 };
}
/**
 * Take every planned block and every piece of generated text out of a page's
 * text, longest first, each at a whole-token match. Longest first across both
 * lists: a generated section number "01" and a planned title "01 / The plan"
 * each find their own occurrence only if the title goes first. Returns the
 * residue and the planned blocks that were not found.
 */
export function subtractAll(text, blocks, slide, scene) {
  const generated = (slide?.nodes || []).filter((n) => n.type === 'text' && GENERATED_ROLES.test(String(n.role || '')))
    .map((n) => ({ needle: normalizeText(n.data?.textLayout?.source ?? n.text), generated: true })).filter((g) => g.needle);
  const planned = blocks.map((block) => ({ block, needle: normalizeText(resolvePages(block.text, scene)) }));
  const lost = [];
  let rest = text;
  for (const item of [...planned, ...generated].sort((a, b) => b.needle.length - a.needle.length || (a.generated ? 1 : -1))) {
    let { at, length } = locate(rest, item.needle);
    if (at < 0 && !item.generated && /\p{L}/u.test(item.needle)) {
      // PDF extraction can split a kerned pair inside a word ("T ony").
      // A label the renderer broke across two lines with a hyphen ("fac-" /
      // "tor") reads back as "fac-tor": the gap may carry that hyphen too.
      const loose = new RegExp([...item.needle.replace(/\s+/g, '')].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('-?\\s?'), 'u').exec(rest);
      if (loose) { at = loose.index; length = loose[0].length; }
    }
    if (at >= 0) rest = rest.slice(0, at) + ' ' + rest.slice(at + length);
    else if (!item.generated) lost.push(item.block);
  }
  return { rest, lost };
}
// Each check takes the deck's { workflow, rulesVersion } as `deck`: a revision
// recorded under an older rules version hears the rules introduced since as
// advisories (weight.json rules), here as at every other gate.
export function checkTextPlan(content, {required = false, deck = null} = {}) {
  const enabled = required || content?.textContract === 'complete';
  const findings = [], scores = [];
  if (!enabled) return {accepted:true, state:'legacy-unverified', findings, scores};
  for (const page of content.pages || []) {
    const fail = (code, reason) => findings.push({page:page.n, id:page.id, code, reason, severity:'blocking'});
    const blocks = page.textPlan;
    if (!Array.isArray(blocks) || !blocks.length || blocks.some(b=>!b.id || !roles.has(b.role) || typeof b.text !== 'string' || !b.text.trim()) || new Set(blocks.map(b=>b.id)).size !== blocks.length) {
      fail('TEXT_PLAN_INCOMPLETE','List every visible text block with a unique id, role and final wording.'); continue;
    }
    // Body words as the task targets count them: the reading-task bank
    // drops any line opening with Source or Note, so a "Note: ..." block is not
    // body here either. Counting it let every page clear its floor by the length
    // of its note, which the rendered density profile then found short.
    const bodyWords = blocks.filter(b=>['body','exhibit','qualification'].includes(b.role) && !NOTE_LINE.test(b.text)).reduce((n,b)=>n+textWords(b.text),0);
    const totalWords = blocks.filter(b=>b.role!=='furniture' && b.role!=='source').reduce((n,b)=>n+textWords(b.text),0);
    // The page names its reading task and is held to that task's target
    // quartiles, which ship with the runtime as numbers.
    if (structural(page)) continue;
    const ref = page.textReference;
    const target = READING_TASK_BANK[ref?.task];
    if (!target) {
      fail('TEXT_REFERENCE_MISSING',`Name this page's reading task in textReference.task: one of ${Object.keys(READING_TASK_BANK).join(', ')}.`); continue;
    }
    // Form, not just volume: the longest single run of prose on the page, and
    // how many runs there are. Exhibit cells and furniture are not prose.
    const prose = blocks.filter(b=>['body','qualification'].includes(b.role)).map(b=>textWords(b.text));
    // The longest run as the reader meets it. A point's bold lead and its text
    // are two nodes and one block: a 171-word scenario passed as a 40-word lead
    // and a 131-word point. And a run set inside an exhibit - a card's text, a
    // table cell - is a wall however it is framed, so it counts here too.
    const runs = new Map();
    for (const b of blocks.filter(b=>['body','qualification','exhibit'].includes(b.role) && !NOTE_LINE.test(b.text))) {
      const key = String(b.id).replace(/:lead:(\d+)$/, ':item:$1');
      runs.set(key, (runs.get(key) || 0) + textWords(b.text));
    }
    const longest = runs.size ? Math.max(...runs.values()) : 0;
    if (longest > TEXT_FORM.longestBlockMax) {
      fail('TEXT_BLOCK_TOO_LONG',
        `One run of ${longest} words; strong decks keep every block under ${TEXT_FORM.longestBlockMax} `
        + `(median block ${TEXT_FORM.wordsPerBlock.median} words, median page ${TEXT_FORM.blocksPerPage.median} blocks). `
        + 'Split it into two or three points that each make their own claim, rather than shortening the sentence.');
    }
    // The page's own floor when its composition set one (the deck's density
    // scale and a photograph's share taken off, derive-content.mjs
    // wordBudgetOf), never below what the largest allowed photograph could
    // take off the density's floor.
    const median = target.bodyWords.median;
    const q1 = target.bodyWords.q1 * (Number.isFinite(ref.floorScale) && ref.floorScale > 0 && ref.floorScale <= 1 ? ref.floorScale : 1);
    const floor = Number.isFinite(ref.floor) ? Math.min(q1, Math.max(ref.floor, Math.round(q1 * (1 - PICTURE_SHARE_MAX)))) : q1;
    const score = {id:page.id,page:page.n,task:ref.task,bodyWords,totalWords,proseBlocks:prose.length,longestBlock:longest,referenceBodyMedian:median,referenceBodyLowerQuartile:floor,referenceTotalMedian:target.totalWords.median,textCoverageScore:median ? Math.round(bodyWords/median*100) : null,explanation:ref.rationale || null};
    scores.push(score);
    // The floor is hard: a written rationale does not release it, or the
    // rationale becomes the way a thin page ships. A page below the lower
    // quartile of the skill's targets for pages doing its job has not done that job;
    // whether a page above the floor is dense enough is the review's density
    // pass (runtime/gates/density_profile.py), not an exception granted here.
    if (bodyWords<floor) fail('TEXT_COVERAGE_LOW',`Planned body has ${bodyWords} words; pages doing this job carry at least ${floor} (lower quartile) and ${median} at the median. The floor is hard: develop the missing explanation, the mechanism, the limitation or the consequence, or move the page to the reading task it actually performs. A rationale does not release it.`);
  }
  const held = applyRulesVersion(findings, deck ?? {});
  return {accepted:!held.some(f=>f.severity==='blocking'),state:'checked',findings:held,scores};
}

export function auditTextPlan(content, scene, {deck = null} = {}) {
  const check = checkTextPlan(content, {deck});
  if (check.state !== 'checked') return check;
  const findings = [...check.findings];
  const found = (finding) => findings.push({ ...finding, code: registered(TEXT_CONTRACT_CODES, finding.code) });
  const plannedIds = new Set((content.pages || []).map(p=>p.id));
  for (const slide of scene.slides) if (!plannedIds.has(slide.id) && !GENERATED_PAGE.test(String(slide.id))) found({id:slide.id,code:'TEXT_PAGE_UNPLANNED',severity:'blocking'});
  for (const page of content.pages || []) {
    const actual = scene.slides.filter(s=>s.id===page.id || s.sourceSlideId===page.id);
    if (!actual.length) { found({id:page.id,code:'TEXT_PAGE_MISSING',severity:'blocking'}); continue; }
    if (actual.length!==1 || actual[0].id!==page.id) { found({id:page.id,code:'TEXT_PLAN_PAGINATION',pages:actual.map(s=>s.id),reason:'Reconcile split pages into individual dot-dash text plans and reference comparisons before export.',severity:'blocking'}); continue; }
    // Whitespace wrapping is immaterial; wording and repeated occurrences are not.
    let text = normalizeText(actual.flatMap(s=>s.nodes.filter(n=>n.type==='text').map(n=>n.data?.textLayout?.source ?? n.text)).join(' '));
    const taken = subtractAll(text, page.textPlan || [], actual[0], scene);
    for (const block of taken.lost) found({id:page.id,block:block.id,code:'TEXT_PLAN_LOST',text:block.text,severity:'blocking'});
    text = taken.rest;
    if (!findings.some(f=>f.id===page.id && f.severity==='blocking') && /[\p{L}\p{N}]/u.test(text)) found({id:page.id,code:'TEXT_UNPLANNED',text:normalizeText(text),severity:'blocking'});
    const mismatch = readingTaskMismatch(page.textReference?.task, actual[0]);
    // The content plan's code (content_gates.mjs CONTENT_CODES), raised here where the composed page settles it.
    if (mismatch) findings.push({id:page.id,code:'TEXT_TASK_MISMATCH',...mismatch,severity:'blocking'});
  }
  const held = applyRulesVersion(findings, deck ?? {});
  return {...check,accepted:!held.some(f=>f.severity==='blocking'),findings:held};
}

// Whether the reading task a page is compared against reads the way the page does.
//
// The word floor is only as honest as the pages it is compared with. Well-made
// chart pages carry a commentary column 38% of the time; the rest are a
// full-width exhibit with a line of takeaway, and they run to about 90 body
// words rather than 150. A deck measured every one of its full-width pages
// against pages that had a commentary column, reached the floor the only way it
// could - a takeaway band four lines deep - and passed. The reverse is the
// loophole storylining already names: a page with a commentary column claiming
// the lighter exhibit-led floor is choosing sparse targets to lower the bar.
// Both are the same mistake, and the composed page settles which one it is.
// The reading-task bank (runtime/reading-tasks.json) names the tasks
// by exhibit family and commentary; the two older names are kept for plans
// written before it.
const BANK = readJsonSync(new URL('./reading-tasks.json', import.meta.url));
export const READING_TASK_BANK = BANK.tasks;
export const READING_TASKS = Object.freeze(Object.fromEntries(Object.entries(BANK.tasks)
  .filter(([, t]) => typeof t.commentary === 'boolean').map(([task, t]) => [task, {commentary: t.commentary}])));
const COMMENTARY_ROLES = new Set(['list-item', 'list-lead', 'paragraph']);
export function readingTaskMismatch(task, slide) {
  const rule = READING_TASKS[task];
  if (!rule || !slide) return null;
  const commentary = (slide.nodes || []).some(n => n.type === 'text' && COMMENTARY_ROLES.has(String(n.role || '')));
  if (commentary === rule.commentary) return null;
  return rule.commentary
    ? {task, commentary, reason: 'This page has no commentary column, so its reading task is exhibit-led: a full-width exhibit with a line of takeaway. Measured against pages with a commentary column, it can only reach the floor by padding its takeaway band. Name an exhibit-led task (chart-led, table-led, diagram-led).'}
    : {task, commentary, reason: 'This page has a commentary column, so exhibit-led targets understate what it should carry. Name a with-commentary task.'};
}

export function auditExportText(content, scene, pageTexts, {deck = null} = {}) {
  const check = checkTextPlan(content, {deck});
  if (check.state !== 'checked') return check;
  const findings = [...check.findings];
  const found = (finding) => findings.push({ ...finding, code: registered(TEXT_CONTRACT_CODES, finding.code) });
  if (pageTexts.length !== scene.slides.length) found({code:'TEXT_EXPORT_PAGE_COUNT',severity:'blocking'});
  for (const page of content.pages || []) {
    const texts = scene.slides.flatMap((s,i)=>s.id===page.id || s.sourceSlideId===page.id ? [pageTexts[i] || ''] : []);
    if (texts.length!==1) { found({id:page.id,code:'TEXT_PLAN_PAGINATION',severity:'blocking'}); continue; }
    // PDF text can have different reading order. Check each planned fragment,
    // and count repeated fragments, without requiring node order to persist.
    // PDF extraction can split a kerned pair inside a word ("T ony"): a block
    // with letters that is not found as written is tried again with optional
    // whitespace between its characters. Numbers are matched as written, so a
    // short cell cannot be found across the gap between two others.
    const taken = subtractAll(normalizeText(texts.join(' ')), page.textPlan || [], scene.slides.find(s=>s.id===page.id || s.sourceSlideId===page.id), scene);
    for (const block of taken.lost) found({id:page.id,block:block.id,code:'TEXT_EXPORT_LOST',text:block.text,severity:'blocking'});
    const actual = taken.rest;
    if (!findings.some(f=>f.id===page.id && f.severity==='blocking') && /[\p{L}\p{N}]/u.test(actual)) found({id:page.id,code:'TEXT_EXPORT_UNPLANNED',text:normalizeText(actual),severity:'blocking'});
  }
  const held = applyRulesVersion(findings, deck ?? {});
  return {...check,stage:'saved-pdf',accepted:!held.some(f=>f.severity==='blocking'),findings:held};
}
