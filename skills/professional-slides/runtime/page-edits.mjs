// Field edits to a deck's pages, applied where each page is written
// (author-deck.mjs <id>.pages.json --apply <edits.json>).
//
// A section's writer edits a part file (pages/<part>.pages.json) many times:
// a replacement the self-check wrote, a reviewer's fix, a judge's rewritten
// line, its own correction after a check. Each was a script of its own - a
// `node -e` or a Python heredoc that read the file, walked to the field and
// wrote it back - a model turn each, often with a bug: the wrong index, the
// file rewritten in another indentation, a page looked for in the pages file
// when it lives in a part. An edit here is data: `{ page, field, value }`,
// the field named by the path the claim sheet, the self-check and the reviews
// already name it by (`exhibit.annotations[2].text`, `points.1.lead`). It is
// checked against the page as written before anything is written - a page
// that is not there, a field the page does not have, an `old` text that is
// not the field's - and every refusal names the fields the page does have. The
// edits are applied together or not at all, each in the file its page is
// written in, by splicing its own bytes (json-text.mjs), so the rest of the
// file stays as it was written.
//
// The answers the readers write are edits too, read as they are saved: a
// section's self-check (out/self-check/<part>.json: each problem's
// `replacement` at its `field`), a section review (each finding's `fix`) and a
// judge's answer.json (each failing line's `replacement`, at the field that
// says that line). Only a closed fix is applied - the whole new text of one
// field. What is not one - a finding routed to the spine or the research, a
// choice a judge named, a line that is not the whole of one field - is listed
// for the writer, not guessed at.
import fs from "node:fs";
import path from "node:path";
import { pageHomesSync } from "./pages-file.mjs";
import { appendEntry, nodeAt, removeEntry, replaceValue, spanTree } from "./json-text.mjs";
import { JUDGEMENT_KINDS, stagedPackets } from "./judgements.mjs";

/** The keys an edit takes: the page and field it changes, and one of `value` (set), `delete: true` or `append: true` (with `value`). */
export const EDIT_KEYS = Object.freeze({
  page: "the page's id",
  field: "the path to the field in the page as written: `title`, `paragraphs[0].text`, `exhibit.rows[3][2]`, `points.1.lead`",
  value: "the field's whole new value, as the page writes it (any JSON); with `append`, the item added to the list, or the field added to the object",
  old: "optional: the field's text as it stands - the edit is refused where it reads otherwise",
  delete: "true takes the field out (an item of a list is taken out of it)",
  append: "true adds `value` at the end of the list at `field`, or adds `field` where the page does not have it yet",
  from: "optional: where the edit came from, said back with it",
});

// A path step: a key, or an index in brackets. A dotted step of digits (`points.1`) is an index where it meets a list.
const STEP = /([^.[\]]+)|\[(\d+)\]/g;
/** The steps of a field path, as the claim sheet and the reviews name a field: `exhibit.rows[3][2]` and `exhibit.rows.3.2` alike. */
export const fieldSteps = (field) => [...String(field ?? "").matchAll(STEP)].map(([, key, index]) => (index === undefined ? key : Number(index)));
const shown = (steps) => steps.map((step, i) => (Number.isInteger(step) ? `[${step}]` : `${i ? "." : ""}${step}`)).join("");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const squeeze = (text) => String(text ?? "").normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, "\"").replace(/\s+/g, " ").trim();
// A value as a line says it: a string quoted, anything else as its JSON; either cut at 120 characters.
const quoted = (value) => { const text = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? String(value); return text.length > 120 ? `${text.slice(0, 117)}...` : text; };

/** The field names `holder` has, as a refusal lists them: an object's keys, a list's indices. */
const fieldsOf = (holder) => (Array.isArray(holder) ? (holder.length ? `a list of ${holder.length} (0 to ${holder.length - 1})` : "an empty list")
  : holder && typeof holder === "object" ? Object.keys(holder).join(", ") || "nothing" : `a ${typeof holder}`);

/** Of `keys`, the one `key` is most likely a slip for: one or two letters off, or one inside the other. */
function nearest(key, keys) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j += 1) { const above = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = above; }
    }
    return row[b.length];
  };
  const scored = keys.map((k) => [k, distance(String(key).toLowerCase(), String(k).toLowerCase())]).filter(([k, d]) => d <= 2 || (String(key).length > 3 && String(k).toLowerCase().includes(String(key).toLowerCase())));
  return scored.sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
}

/**
 * Every edit checked against the pages of `file` as they are written, in
 * order - each on the page as the edits before it leave it - as `{ changes,
 * refusals, unchanged }`. A change is `{ page, field, op, was, now, part }`;
 * `unchanged` are edits the page already reads as (an answer applied twice is
 * not refused); `refusals` say what is wrong with each other edit, naming the
 * fields the page has. `readAs(page, field)` gives a field's text as its
 * reader reads it, tokens written out - an `old` the self-check or a judge
 * read in print matches it. The changes are applied with applyChanges.
 */
export function planEdits(file, edits, { readAs = () => undefined } = {}) {
  const homes = pageHomesSync(file), files = new Map(), changes = [], refusals = [], unchanged = [];
  const dataOf = (at) => { if (!files.has(at)) { const text = fs.readFileSync(at, "utf8"); files.set(at, { text, data: JSON.parse(text) }); } return files.get(at).data; };
  edits.forEach((edit, i) => {
    const at = `edit ${i + 1}${edit?.from ? ` (${edit.from})` : ""}`;
    const refuse = (why) => refusals.push(`${at}: ${why}`);
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) return refuse(`an edit is { "page", "field", "value" } (or "delete": true, or "append": true with "value")`);
    const extra = Object.keys(edit).filter((key) => !Object.hasOwn(EDIT_KEYS, key) && key !== "add");
    if (extra.length) return refuse(`${extra.map((key) => `\`${key}\``).join(", ")} ${extra.length === 1 ? "is" : "are"} not ${extra.length === 1 ? "a key" : "keys"} of an edit, which takes ${Object.keys(EDIT_KEYS).map((key) => `\`${key}\``).join(", ")}`);
    const op = edit.delete === true ? "delete" : edit.append === true ? "append" : "set";
    if (edit.delete === true && edit.append === true) return refuse("an edit deletes or appends, not both");
    if (op !== "delete" && !Object.hasOwn(edit, "value")) return refuse(`no \`value\` - give the field's whole new value${op === "append" ? " to append" : ", or `\"delete\": true` to take it out"}`);
    const home = homes.get(String(edit.page ?? ""));
    if (!home) return refuse(`no page ${JSON.stringify(edit.page ?? null)} in ${path.basename(file)} or its parts; its pages are ${[...homes.keys()].join(", ")}`);
    const steps = fieldSteps(edit.field);
    if (!steps.length) return refuse(`no \`field\` - name the path to the field in ${edit.page}, as \`title\`, \`points[1].lead\` or \`exhibit.rows[3][2]\``);
    if (steps.length === 1 && steps[0] === "id") return refuse(`an edit does not rename a page: \`id\` is how every record finds ${edit.page}`);
    const page = home.route.reduce((node, step) => node?.[step], dataOf(home.file));
    // Walk to the field's holder; a dotted index meets a list as an index.
    let holder = page;
    const resolved = [];
    for (const [k, raw] of steps.entries()) {
      const step = Array.isArray(holder) && /^\d+$/.test(String(raw)) ? Number(raw) : raw;
      if (Number.isInteger(step) && !Array.isArray(holder)) return refuse(`${edit.page} has no list at \`${shown(resolved) || "the page"}\` to index - it holds ${fieldsOf(holder)}`);
      const last = k === steps.length - 1;
      const has = holder && typeof holder === "object" && (Array.isArray(holder) ? Number.isInteger(step) && step < holder.length : Object.hasOwn(holder, step));
      if (!has && !(last && (op === "append" || edit.add === true) && holder && typeof holder === "object" && !Array.isArray(holder))) {
        const where = resolved.length ? `\`${shown(resolved)}\` holds ${fieldsOf(holder)}` : `it holds ${fieldsOf(holder)}`;
        const guess = holder && typeof holder === "object" && !Array.isArray(holder) ? nearest(step, Object.keys(holder)) : null;
        const adding = last && op === "set" && holder && typeof holder === "object" && !Array.isArray(holder) ? `; to add a field the page does not have, say \`"append": true\`` : "";
        return refuse(`${edit.page} has no \`${shown([...resolved, step])}\` (in ${home.part}): ${where}${guess ? ` - \`${shown([...resolved, guess])}\`?` : ""}${adding}`);
      }
      resolved.push(step);
      if (!last) { holder = holder[step]; if (!holder || typeof holder !== "object") return refuse(`${edit.page}'s \`${shown(resolved)}\` is ${quoted(holder)}, not a list or an object a path runs on through`); }
    }
    const key = resolved.at(-1), exists = Array.isArray(holder) ? key < holder.length : Object.hasOwn(holder, key);
    const current = exists ? holder[key] : undefined, field = shown(resolved);
    // An edit the page already reads as is done, whatever `old` says: an answer applied twice is not refused the second time.
    if (op === "set" && exists && same(current, edit.value)) return unchanged.push({ page: String(edit.page), field, from: edit.from ?? null });
    if (edit.old !== undefined && exists) {
      const read = readAs(String(edit.page), field);
      const matches = same(current, edit.old) || (typeof edit.old === "string" && [current, read].some((text) => typeof text === "string" && squeeze(text) === squeeze(edit.old)));
      if (!matches) return refuse(`${edit.page} \`${field}\` reads ${quoted(current)}${typeof read === "string" && read !== current ? ` (${quoted(read)} as printed)` : ""}, and the edit expects ${quoted(edit.old)}: the page changed since it was read - read it again and write the edit to what it says now`);
    }
    if (op === "delete") {
      if (Array.isArray(holder)) holder.splice(key, 1); else delete holder[key];
      return changes.push({ page: String(edit.page), field, op, was: current, now: undefined, part: home.part, file: home.file, route: [...home.route, ...resolved], from: edit.from ?? null });
    }
    if (op === "append" && exists && !Array.isArray(current)) return refuse(`${edit.page} \`${field}\` is ${quoted(current)}, not a list to append to: set it (\`value\` alone) instead`);
    if (op === "append" && exists) {
      current.push(structuredClone(edit.value));
      return changes.push({ page: String(edit.page), field: `${field}[${current.length - 1}]`, op, was: undefined, now: edit.value, part: home.part, file: home.file, route: [...home.route, ...resolved], from: edit.from ?? null });
    }
    holder[key] = structuredClone(edit.value);
    changes.push({ page: String(edit.page), field, op: exists ? "set" : "add", was: current, now: edit.value, part: home.part, file: home.file, route: [...home.route, ...resolved], from: edit.from ?? null });
  });
  return { changes, refusals, unchanged, expected: new Map([...files].map(([at, { text, data }]) => [at, { text, data }])) };
}

/**
 * The changes planEdits made, written into their files: each spliced into the
 * file's own text in order, the result read back and held to the pages the
 * plan left in memory before a byte is written, and each file written whole
 * (to a file of this process's own, then renamed), so a writer checking beside
 * it never reads half a file. Returns the files written, relative to the pages
 * file's folder.
 */
export function applyChanges(plan) {
  const byFile = new Map();
  for (const change of plan.changes) byFile.set(change.file, [...(byFile.get(change.file) ?? []), change]);
  const texts = new Map();
  for (const [file, changes] of byFile) {
    let text = plan.expected.get(file).text;
    for (const change of changes) {
      const tree = spanTree(text), container = nodeAt(tree, change.route.slice(0, -1)), key = change.route.at(-1);
      if (change.op === "add") text = appendEntry(text, container, change.now, { key });
      else if (change.op === "append") text = appendEntry(text, nodeAt(tree, change.route), change.now);
      else if (change.op === "delete") text = removeEntry(text, container, container.kind === "array" ? key : container.members.findIndex((member) => member.key === key));
      else text = replaceValue(text, { node: nodeAt(tree, change.route), container }, change.now);
    }
    // What the splices wrote is what the plan meant, or nothing is written at all.
    if (!same(JSON.parse(text), plan.expected.get(file).data)) throw new Error(`the edits to ${changes[0].part} did not write what they meant; nothing was written`);
    texts.set(file, text);
  }
  for (const [file, text] of texts) { const staged = `${file}.${process.pid}.tmp`; fs.writeFileSync(staged, text); fs.renameSync(staged, file); }
  return [...byFile.values()].map((changes) => changes[0].part);
}

/** A change as a line: the page and field, what it was and what it is now. */
export function changeLine(change) {
  const was = change.was === undefined ? "(none)" : quoted(change.was), now = change.now === undefined ? "(taken out)" : quoted(change.now);
  return `${change.page} ${change.field} [${change.part}]${change.from ? ` (${change.from})` : ""}\n    was: ${was}\n    now: ${now}`;
}

// The keys of a page that are never words its reader reads: a judged line is not looked for in them.
const UNREAD = new Set(["id", "type", "form", "kind", "commentary", "why", "adds", "evidence", "settles", "source", "basis", "measure", "format", "select", "role",
  "relevance", "icon", "treatment", "variant", "arrangement", "placement", "tone", "alt", "src", "image", "photo", "url", "key", "include"]);

/** Every text of `page` a reader may read, as `[{ field, text }]` - the field by the path an edit names it with. */
function textsOf(page) {
  const found = [];
  const walk = (node, route) => {
    if (typeof node === "string") { found.push({ field: shown(route), text: node }); return; }
    if (Array.isArray(node)) { node.forEach((child, i) => walk(child, [...route, i])); return; }
    if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) if (!UNREAD.has(key)) walk(child, [...route, key]);
  };
  walk(page, []);
  return found;
}

/**
 * The fields of the pages `where` names (every page where it names none)
 * whose whole text - as written, or as printed (`printed`, the pages with
 * their tokens written out) - is `line`: `[{ page, field }]`.
 */
function fieldsSaying(line, where, { pages, printed }) {
  const wanted = squeeze(line), ids = where.length ? where.map(String) : [...pages.keys()];
  return ids.flatMap((id) => {
    const page = pages.get(id);
    if (!page) return [];
    const read = new Map(textsOf(printed.get(id) ?? page).map(({ field, text }) => [field, text]));
    return textsOf(page).filter(({ field, text }) => squeeze(text) === wanted || squeeze(read.get(field)) === wanted).map(({ field }) => ({ page: id, field }));
  });
}

/**
 * The edits an `--apply` file holds, as `{ kind, edits, open }`: a list of
 * edits as written (or `{ edits: [...] }`), or one of the answers the readers
 * write, read as it is saved -
 *   a self-check (`{ section, pages, problems }`): each problem with a `field`
 *     and a `replacement`, the replacement set at the field, `old` the text
 *     the checker read (`claim`);
 *   a section review (`{ part, findings }`): each finding's `fix` entries,
 *     `{ page, field, value }`, the field added where the page lacks it (the
 *     review's own check holds a fix to a field whose holder is there);
 *   a judge's answer (`{ batch, judgements }`, its packet.json beside it or
 *     staged under judgements/): each failing line's `replacement`, at the one
 *     field of the pages the question was asked of whose whole text is that
 *     line.
 * `open` lists what is not a closed fix, with why: the writer acts on it.
 * `pages` maps page id to the page as written and `printed` to the page with
 * its tokens written out; `dir` is the pages file's folder (for staged packets).
 */
export async function editsFrom(input, { at, dir, pages, printed = new Map() }) {
  if (Array.isArray(input)) return { kind: "edits", edits: input, open: [] };
  if (!input || typeof input !== "object") return { kind: null, edits: [], open: [], why: "an --apply file is a list of edits ([{ \"page\", \"field\", \"value\" }]), a self-check answer, a section-review answer or a judge's answer.json" };
  if (Array.isArray(input.edits)) return { kind: "edits", edits: input.edits, open: [] };
  if (Array.isArray(input.judgements) && input.batch !== undefined) return judgeEdits(input, { at, dir, pages, printed });
  if (Array.isArray(input.findings) && input.part && typeof input.part === "object") {
    const edits = [], open = [];
    for (const finding of input.findings) {
      if (!finding || finding.severity === "none") continue;
      const named = `finding ${finding.id ?? "?"}`;
      if (finding.route) { open.push(`${named} (${(finding.slides || []).join(", ")}): routed to the ${finding.route}, not a fix of the page - take it to that stage`); continue; }
      if (!Array.isArray(finding.fix) || !finding.fix.length) { open.push(`${named} (${(finding.slides || []).join(", ")}): carries no fix - its repair is the writer's: ${String(finding.repair ?? finding.problem ?? "").slice(0, 160)}`); continue; }
      for (const fix of finding.fix) edits.push({ page: fix?.page, field: fix?.field, value: fix?.value, add: true, from: named });
    }
    return { kind: "section-review", edits, open };
  }
  if (Array.isArray(input.problems) || (input.pages && typeof input.pages === "object" && !Array.isArray(input.pages))) {
    const edits = [], open = [];
    (input.problems || []).forEach((problem, i) => {
      const named = `problem ${i + 1}`;
      if (typeof problem?.field !== "string" || typeof problem?.replacement !== "string" || !problem.replacement.trim()) { open.push(`${named} (${problem?.slide ?? "?"}${problem?.field ? ` ${problem.field}` : ""}): no field and whole replacement - say it to the writer`); return; }
      edits.push({ page: problem.slide, field: problem.field, value: problem.replacement, ...(typeof problem.claim === "string" ? { old: problem.claim } : {}), from: named });
    });
    return { kind: "self-check", edits, open };
  }
  return { kind: null, edits: [], open: [], why: `${path.basename(at)} is not a list of edits ([{ "page", "field", "value" }]), a self-check answer ({ section, pages, problems }), a section-review answer ({ part, findings }) or a judge's answer.json ({ batch, judgements })` };
}

/** A judge's answer as edits: each failing line's replacement where its packet's question says the line is. */
async function judgeEdits(answer, { at, dir, pages, printed }) {
  const beside = path.join(path.dirname(at), "packet.json");
  const own = fs.existsSync(beside) ? JSON.parse(fs.readFileSync(beside, "utf8")) : null;
  const packet = own?.batch === answer.batch ? own : (await stagedPackets(dir)).find((staged) => staged.packet.batch === answer.batch)?.packet;
  if (!packet) return { kind: "judge", edits: [], open: [], why: `no packet for batch "${answer.batch}" beside ${path.basename(at)} or staged under judgements/: apply a judge's answer from its packet's folder` };
  const items = new Map(packet.items.map((item) => [item.key, item]));
  const edits = [], open = [];
  for (const said of answer.judgements) {
    const item = items.get(said?.key), fix = JUDGEMENT_KINDS[item?.kind]?.fix;
    if (!item || !fix || !fix.for.includes(said.verdict)) continue;
    const named = `${item.kind} ${said.key}`;
    if (fix.by !== "replace") { open.push(`${named} (${(item.where || []).join(", ")}): "${said.verdict}" is mended by a choice, not a line - ${said.fix ?? "make the change it names"}`); continue; }
    if (typeof said.replacement !== "string" || !said.replacement.trim()) { open.push(`${named}: "${said.verdict}" with no replacement - the answer is refused by judge.mjs --validate`); continue; }
    if (typeof item.subject !== "string") { open.push(`${named}: its subject is not one line, and its replacement is the writer's to place`); continue; }
    const found = fieldsSaying(item.subject, item.where || [], { pages, printed });
    if (found.length !== 1) { open.push(`${named}: ${found.length ? `${found.length} fields (${found.map((f) => `${f.page} ${f.field}`).join(", ")}) read` : "no field reads"} ${quoted(item.subject)} whole - replace it by hand: ${quoted(said.replacement.trim())}`); continue; }
    edits.push({ ...found[0], value: said.replacement.trim(), old: item.subject, from: named });
  }
  return { kind: "judge", edits, open };
}
