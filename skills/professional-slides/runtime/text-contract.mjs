// The words a deck's pages set, and whether every one reached the saved file.
//
// The text plan (derive-content.mjs) lists every visible block of a composed
// page; the build checks each survives export, page by page, against the text
// read back from the render (auditExportText). The word helpers here are the
// one definition of a word every module counts with.
import { registered } from "./errors.mjs";

const roles = new Set(['title', 'body', 'exhibit', 'qualification', 'source', 'furniture']);

// What the audit of the planned text against the saved file can find (auditExportText); every one blocks.
export const TEXT_CONTRACT_CODES = Object.freeze({
  TEXT_PLAN_PAGINATION: "a planned page split across several composed or saved pages",
  TEXT_EXPORT_PAGE_COUNT: "the saved file has a different number of pages than the scene",
  TEXT_EXPORT_LOST: "a planned block of text missing from its saved page",
  TEXT_EXPORT_UNPLANNED: "text on a saved page that the plan never wrote",
});
const NORMALIZED = new Map();
const normalizeOnce = value => String(value ?? '').normalize('NFKC').replace(/[\u00ad\u200b]/g, '').replace(/-\s*\r?\n\s*/g, '-').replace(/\s+/g, ' ').trim();
// The structure search reads the same pages' words tens of thousands of times: a string normalises once.
export const normalizeText = value => {
  if (typeof value !== 'string') return normalizeOnce(value);
  let hit = NORMALIZED.get(value);
  if (hit === undefined) { if (NORMALIZED.size > 200000) NORMALIZED.clear(); hit = normalizeOnce(value); NORMALIZED.set(value, hit); }
  return hit;
};
// The one definition of a word (gates/text_stats.py ports it): the normalised
// text split on whitespace, every token a word.
export const textWordList = value => { const text = normalizeText(value); return text ? text.split(' ') : []; };
const WORDS = new Map();
export const textWords = value => {
  if (typeof value !== 'string') return textWordList(value).length;
  let hit = WORDS.get(value);
  if (hit === undefined) { if (WORDS.size > 200000) WORDS.clear(); hit = textWordList(value).length; WORDS.set(value, hit); }
  return hit;
};
/** Words set as said - a table's quote cell, a spectrum pole's voice: in curly quotation marks, the author's own taken off first. */
export const quoted = value => `“${String(value).trim().replace(/^[“"‘']+|[”"’']+$/g, '')}”`;
// A paragraph as authored: a string, or `{ lead, text }` - the subheading a
// reader scans by and the prose under it. Every reader of `paragraphs` takes
// it through these two, so a lead is counted, checked and drawn wherever the
// prose is.
export const proseParts = p => (p && typeof p === 'object')
  ? { lead: typeof p.lead === 'string' ? p.lead.trim() : '', text: String(p.text ?? ''), highlight: [p.highlight ?? []].flat().filter(h => typeof h === 'string' && h.trim()) }
  : { lead: '', text: String(p ?? ''), highlight: [] };
// The longest paragraph the composer sets in one block before it splits the
// prose into equal paragraphs (compose-points.mjs).
export const PROSE_PARAGRAPH_MAX = 60;
/** A paragraph's words as the reader meets them: its lead, then its prose. */
export const proseText = p => { const { lead, text } = proseParts(p); return lead ? `${lead} ${text}` : text; };
const resolvePages = (value, scene) => String(value).replace(/\{\{page:([^}]+)\}\}/g, (_, id) => {
  const numbers = scene.slides.flatMap((s,i)=>s.id===id || s.sourceSlideId===id ? [i+1] : []);
  return numbers.length ? numbers.length>1 ? `${numbers[0]}–${numbers.at(-1)}` : String(numbers[0]) : `{{page:${id}}}`;
});
// Text the runtime writes rather than the author: axis ticks, page numbers,
// tracker and contents labels, numbering, the deck footer, legend values, a
// timeline's step between dates (schedule-stages.mjs). It is checked by the
// runtime's own gates; the text plan need not list it, and the audits subtract
// it after matching what the plan does list.
export const GENERATED_ROLES = /^(page-number|axis-label|tracker-|agenda-marker-label|table-section-number|table-row-number|footer-(left|right)|divider-number|divider-contents|map-size-legend-label|timeline-elapsed)/;
// A page the build generates - the picture credits, the sources' declared limits (page_gates.py GENERATED_PAGE).
export const GENERATED = /^(?:picture-credits|source-limits)(?:-\d+)?$/;
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
/**
 * What is wrong with a page's text plan, a clause each, naming the blocks by their place (from 1) and id: none, empty, a
 * block with no id, a role outside the plan's roles, no wording, an id written twice. Empty where the plan is whole.
 */
function planProblems(blocks) {
  if (!Array.isArray(blocks)) return [`is ${blocks === undefined ? 'missing' : `a ${typeof blocks}, not a list of blocks`}`];
  if (!blocks.length) return ['lists no block'];
  const at = (i, b) => `block ${i + 1}${b?.id ? ` ("${b.id}")` : ''}`;
  const out = [];
  blocks.forEach((b, i) => {
    if (!b?.id) out.push(`${at(i, b)} has no \`id\``);
    if (!roles.has(b?.role)) out.push(`${at(i, b)} has role ${JSON.stringify(b?.role ?? null)}, not one of the ${roles.size}`);
    if (typeof b?.text !== 'string' || !b.text.trim()) out.push(`${at(i, b)} has no \`text\``);
  });
  const seen = new Map();
  blocks.forEach((b, i) => { if (b?.id) seen.set(b.id, [...(seen.get(b.id) ?? []), i + 1]); });
  for (const [id, places] of seen) if (places.length > 1) out.push(`id "${id}" is written ${places.length} times (blocks ${places.join(', ')})`);
  return out.length ? [`has ${blocks.length} block${blocks.length === 1 ? '' : 's'}, and ${out.length} ${out.length === 1 ? 'fault' : 'faults'}: ${out.slice(0, 6).join(', ')}${out.length > 6 ? `, and ${out.length - 6} more` : ''}`] : [];
}

/** Whether the content plan's text plans are whole: `{ accepted, state, findings }`, a TEXT_PLAN_INCOMPLETE finding a page. */
export function checkTextPlan(content) {
  const findings = [];
  if (content?.textContract !== 'complete') return {accepted:true, state:'legacy-unverified', findings};
  for (const page of content.pages || []) {
    const wrong = planProblems(page.textPlan);
    if (!wrong.length) continue;
    // A plan derived from the composed page (derive-content.mjs) is the page's own text: one that is empty or repeats an
    // id says the page composed no text, or drew a node twice - the page is mended, not the plan.
    const derived = content.derivedFrom === 'pages';
    findings.push({page:page.n, id:page.id, code:'TEXT_PLAN_INCOMPLETE', severity:'blocking', reason:`${page.id ?? `page ${page.n}`}: ${derived ? 'the text plan read off the composed page' : `\`pages[${(page.n ?? 1) - 1}].textPlan\` in the content plan`} ${wrong.join('; ')}. `
      + (derived && (!Array.isArray(page.textPlan) || !page.textPlan.length)
        ? 'The page composed no text it can be read by: mend the refusal that kept it from composing (its compose finding), or give it the copy its type and form read (--scaffold <type>/<form> prints them).'
        : `Write each visible block once as { id, role, text }: \`id\` unique on the page, \`role\` one of ${[...roles].join(', ')}, \`text\` its final wording.`)});
  }
  return {accepted:!findings.length, state:'checked', findings};
}

export function auditExportText(content, scene, pageTexts) {
  const check = checkTextPlan(content);
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
  return {...check,stage:'saved-pdf',accepted:!findings.some(f=>f.severity==='blocking'),findings};
}
