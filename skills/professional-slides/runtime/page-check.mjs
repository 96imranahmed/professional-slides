// What a page check drew, and which section reviews still stand on it.
//
// A page run that renders (author-deck.mjs --check --render --page <ids>)
// keeps each page's image in out/page-check/<id>.png; beside it now goes
// out/page-check/<id>.json, the page as drawn (its scene record), the hash of
// that drawing and of the page as written, and whether the run found it clean.
// A section's pages that all checked clean, and are as written when they
// checked, can be reviewed while the other sections are still being written
// (section-review.mjs): on the BA retest (ba4) the one review at the end read
// 102 pages in 12 packets over 19 minutes and found 171 defects, most of them
// page craft a reader of one section could have seen as soon as it was drawn.
//
// A section review binds to the pages it read, as the self-check binds to its
// claims. At the final review each of its pages is read as one of three:
// unchanged (drawn as the reviewer saw it: the verdict stands, and a finding
// on it that was not fixed stays open), fixed (changed only by that review's
// own fixes, applied word for word and checked clean: the verdict stands and
// those findings are closed), or changed (anything else: the final review
// reads it again on the page dimensions). Nothing is skipped silently.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readJson, writeJson } from "./cli.mjs";

export const PAGE_CHECK = "page-check";
export const SECTION_REVIEW = "section-review";
const hash = (value) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

// The deck's running chrome - the page number, the section tracker, the
// footer - moves with every page added before it or section added beside it,
// and is the same on every page; a reviewer reads none of it as the page's.
const CHROME = /^(page-number|footer-right|tracker)/;
/** The hash of a page as drawn: its scene record, the deck's running chrome left out. */
export const drawnHash = (slide) => hash({ ...slide, nodes: (slide?.nodes || []).filter((n) => !CHROME.test(String(n.role ?? ""))) });
/** The hash of a page as written: its record in the pages file. */
export const sourceHash = (page) => hash(page);

/** A page check's record of `id` in the output folder, or null. */
export const readPageCheck = (out, id) => readJson(path.join(out, PAGE_CHECK, `${id}.json`), { optional: true }).catch(() => null);

/**
 * Record what a rendering page run drew: for each page, its scene record and
 * the two hashes, whether the run found it clean (`blocking`, the codes of
 * the blocking findings that name it) and the density profile's reading of it.
 */
export async function recordPageChecks(out, { slides, pages, blocking, density = new Map() }) {
  const dir = path.join(out, PAGE_CHECK);
  await fs.mkdir(dir, { recursive: true });
  for (const [id, slide] of slides) {
    const codes = blocking(id);
    await writeJson(path.join(dir, `${id}.json`), { schema: "professional-slides.page-check/v1", id, drawn: drawnHash(slide), source: sourceHash(pages.get(id) ?? null),
      clean: !codes.length, blocking: codes, density: density.get(id) ?? null, checkedAt: new Date().toISOString(), slide });
  }
}

/** A page record with a fix's replacements in place: each `{ field, value }` sets the dotted path (an index for a list item) to its whole new value. */
export function applyFixes(page, fixes) {
  const copy = structuredClone(page ?? {});
  for (const { field, value } of fixes) {
    const keys = String(field).split(".");
    let at = copy;
    for (const key of keys.slice(0, -1)) at = at?.[key];
    if (at && typeof at === "object") at[keys.at(-1)] = structuredClone(value);
  }
  return copy;
}

/** Each fix of a section review's answer on `id`, in the order its findings give them. */
export const fixesOn = (answer, id) => (answer?.findings || []).filter((f) => f?.severity !== "none").flatMap((f) => (Array.isArray(f.fix) ? f.fix : [])).filter((fix) => fix?.page === id);

/**
 * The section reviews that stand at the final review, read against the build's
 * scene: `null` where no section was reviewed, else `{ parts, reread, status,
 * records }`. `parts` are the reviews as parts of the final review's merge -
 * their standing pages, those pages' entries and the findings still open on an
 * unchanged page, each finding id prefixed with its section; `reread` the pages
 * the final review reads on the page dimensions (changed since their review,
 * or never reviewed); `status` each reviewed page's reading; `records` what
 * each review closed, carried and gave back. An answer whose packet record is
 * gone or bound to other pages stands for nothing, and says so.
 */
export async function standingSectionReviews(out, scene) {
  const dir = path.join(out, SECTION_REVIEW);
  const names = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json") && !f.endsWith(".packet.json")).sort();
  if (!names.length) return null;
  const drawn = new Map(scene.slides.map((s) => [s.id, drawnHash(s)]));
  const status = new Map(), parts = [], records = [];
  for (const name of names) {
    const answer = await readJson(path.join(dir, name), { optional: true }).catch(() => null);
    const part = name.replace(/\.json$/, "");
    const record = await readJson(path.join(dir, `${part}.packet.json`), { optional: true }).catch(() => null);
    if (!answer || !record || answer.binding !== record.binding) { records.push({ part, standing: 0, invalid: !record ? "no packet record" : "bound to other pages than its packet" }); continue; }
    const own = new Map();
    for (const page of record.pages) {
      if (!drawn.has(page.id)) continue;
      if (drawn.get(page.id) === page.drawn) { own.set(page.id, "unchanged"); continue; }
      const fixes = fixesOn(answer, page.id), check = await readPageCheck(out, page.id);
      const fixed = fixes.length && check?.clean && check.drawn === drawn.get(page.id) && check.source === sourceHash(applyFixes(page.page, fixes));
      own.set(page.id, fixed ? "fixed" : "changed");
    }
    for (const [id, read] of own) status.set(id, { part, read });
    const standing = [...own].filter(([, read]) => read !== "changed").map(([id]) => id);
    const at = (id) => own.get(id);
    // Open: a finding on a page drawn as the reviewer saw it. Fixed pages close theirs; a changed page is read again.
    const open = (answer.findings || []).filter((f) => f.severity === "none" ? (f.slides || []).some((id) => at(id) && at(id) !== "changed") : (f.slides || []).some((id) => at(id) === "unchanged"));
    const closed = (answer.findings || []).filter((f) => f.severity !== "none" && !open.includes(f) && (f.slides || []).some((id) => at(id) === "fixed")).length;
    const prefix = `sr-${part}`;
    records.push({ part, standing: standing.length, unchanged: standing.filter((id) => at(id) === "unchanged").length, fixed: standing.filter((id) => at(id) === "fixed").length,
      reread: [...own].filter(([, read]) => read === "changed").map(([id]) => id), closed, carried: open.map((f) => `${prefix}.${f.id}`) });
    if (!standing.length) continue;
    const keep = new Set(standing);
    // A section review's own fields stay behind: the fix was applied or is still owed, and the final review's schema takes neither.
    const findings = open.map(({ fix: _fix, route: _route, ...f }) => ({ ...f, id: `${prefix}.${f.id}` }));
    parts.push({ part: { kind: "section", id: prefix, slides: standing }, binding: answer.binding, accepted: answer.accepted, summary: answer.summary, rating: answer.rating,
      opened: (answer.opened || []).filter((id) => keep.has(id)), provenance: answer.provenance, pages: (answer.pages || []).filter((p) => keep.has(p.slide)), findings,
      completeness: answer.completeness, density: { deck: answer.density?.deck ?? "", pages: (answer.density?.pages || []).filter((p) => keep.has(p.slide)) } });
  }
  const reread = scene.slides.map((s) => s.id).filter((id) => status.get(id)?.read !== "unchanged" && status.get(id)?.read !== "fixed");
  return { parts, reread, status: Object.fromEntries(status), records };
}
