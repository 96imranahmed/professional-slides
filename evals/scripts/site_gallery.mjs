#!/usr/bin/env node
// The published gallery (shiphappens.xyz/slides), reproduced page by page, as a layout regression suite.
//
//   node evals/scripts/site_gallery.mjs                  compare every page's layout with the approved one (exit 1 on a move)
//   node evals/scripts/site_gallery.mjs --sheet [OUT]    draw every moved page as approved and as it is now, side by side,
//                                                        one contact sheet a page plus an index (default output/site-gallery/review/)
//   node evals/scripts/site_gallery.mjs --approve        record the layout as it is now; refused until a sheet of the
//                                                        current moves has been written (--force records without one)
//
// evals/regression/site-gallery/pages/*.json hold the pages (one per published slide, id `<type>-<form>`),
// published.json the names of the published slides and the ones not reproduced, layout.json the approved frames of
// every component, layout.meta.json the commit the approval was recorded at (the "before" of a sheet is that
// commit's runtime and pages, compiled in a temporary git worktree). The published images themselves are not kept in
// the repository: a sheet adds one as a third panel where output/site-gallery/reference-png/<type>__<form>.png exists.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { authorDeck, workedExamples } from "../../skills/professional-slides/runtime/author-deck.mjs";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SUITE = "evals/regression/site-gallery";
const root = path.join(repo, SUITE);
const TOLERANCE = 1;
const DEFAULT_SHEETS = path.join(repo, "output/site-gallery/review");
const REFERENCES = path.join(repo, "output/site-gallery/reference-png");
// Where the last sheet's fingerprint is kept, whatever folder the sheet went to: --approve reads it here.
const STAMP = path.join(repo, "output/site-gallery/last-sheet.json");
const SHEET_COMMAND = "node evals/scripts/site_gallery.mjs --sheet";

/** The gallery pages of the checkout at `checkout`, compiled by that checkout's own runtime: `{ pages, blocking, layout, deck }`. */
async function compileGallery(checkout, authoring = { authorDeck, workedExamples }) {
  const doc = authoring.workedExamples();
  const pagesDir = path.join(checkout, SUITE, "pages");
  doc.pages = fs.readdirSync(pagesDir).filter((name) => name.endsWith(".json")).sort().flatMap((name) => JSON.parse(fs.readFileSync(path.join(pagesDir, name), "utf8")));
  // Pictures are the examples' own (`assets/...`), so the suite carries none.
  const authored = await authoring.authorDeck(doc, { baseDir: path.join(checkout, "skills/professional-slides/examples") });
  const ids = new Set(doc.pages.map((page) => String(page.id)));
  const layout = {}, slides = {};
  for (const slide of authored.deck?.slides ?? []) {
    const id = String(slide.sourceSlideId ?? slide.id);
    if (!ids.has(id)) continue;
    (slides[id] ??= []).push(slide);
    (layout[id] ??= []).push(...slide.componentInstances.map((instance) => [instance.component, ...["x", "y", "width", "height"].map((key) => Math.round(instance.frame[key]))]));
  }
  return { pages: [...ids], blocking: authored.blocking.map((finding) => ({ id: finding.id, code: finding.code, repair: finding.repair })), layout, deck: authored.deck, slides };
}

/** Every reproduced page, compiled: `{ pages, blocking, layout }`, the layout as `{ <page id>: [[component, x, y, width, height]] }`. */
export async function galleryLayout() {
  const { pages, blocking, layout } = await compileGallery(repo);
  return { pages, blocking, layout };
}

/** The pages whose components are not where the approved layout has them. */
export function moved(approved, layout) {
  const far = (a, b) => a[0] !== b[0] || a.slice(1).some((value, at) => Math.abs(value - b[at + 1]) > TOLERANCE);
  return Object.keys({ ...approved, ...layout }).filter((id) => !approved[id] || !layout[id] || approved[id].length !== layout[id].length || approved[id].some((frame, at) => far(frame, layout[id][at]))).sort();
}

/** The fingerprint of a set of moves: the moved pages with their approved and current frames. A sheet carries it; --approve asks for it. */
export function movesHash(approved, layout) {
  const ids = moved(approved, layout);
  return crypto.createHash("sha256").update(JSON.stringify(ids.map((id) => [id, approved[id] ?? null, layout[id] ?? null]))).digest("hex").slice(0, 16);
}

const signed = (value) => (value > 0 ? `+${value}` : `${value}`);
const box = ([, x, y, width, height]) => `${x},${y} ${width}x${height}`;

/**
 * What moved on one page, in words: `{ summary, lines, before, after }`, `before`/`after` the changed frames as
 * `[number, component, x, y, width, height]` (number = the component's place on the page, from 1) to outline.
 */
export function describeMove(approved, now) {
  if (!approved) return { summary: "new page: not in the approved layout", lines: [], before: [], after: [] };
  if (!now) return { summary: "no longer drawn: in the approved layout, missing now", lines: [], before: [], after: [] };
  const lines = [], before = [], after = [], names = new Map(), sizes = [];
  const shared = Math.min(approved.length, now.length);
  for (let at = 0; at < shared; at += 1) {
    const a = approved[at], b = now[at];
    const deltas = ["x", "y", "w", "h"].map((key, k) => [key, b[k + 1] - a[k + 1]]).filter(([, d]) => Math.abs(d) > TOLERANCE);
    if (a[0] !== b[0]) {
      lines.push(`#${at + 1} ${a[0]} ${box(a)} became ${b[0]} ${box(b)}`);
    } else if (deltas.length) {
      lines.push(`#${at + 1} ${a[0]}  ${box(a)} -> ${box(b)}  (${deltas.map(([key, d]) => `${key} ${signed(d)}`).join(", ")})`);
      sizes.push(...deltas.map(([, d]) => Math.abs(d)));
    } else continue;
    names.set(a[0], (names.get(a[0]) ?? 0) + 1);
    before.push([at + 1, ...a]);
    after.push([at + 1, ...b]);
  }
  for (let at = shared; at < approved.length; at += 1) { lines.push(`#${at + 1} ${approved[at][0]} ${box(approved[at])} is gone`); before.push([at + 1, ...approved[at]]); }
  for (let at = shared; at < now.length; at += 1) { lines.push(`#${at + 1} ${now[at][0]} ${box(now[at])} is new`); after.push([at + 1, ...now[at]]); }
  const which = [...names].map(([name, count]) => (count > 1 ? `${name} x${count}` : name)).join(", ");
  const parts = [];
  if (names.size) parts.push(`${[...names.values()].reduce((sum, n) => sum + n, 0)} of ${approved.length} components moved (${which})${sizes.length ? `, by up to ${Math.max(...sizes)}px` : ""}`);
  if (approved.length !== now.length) parts.push(`components ${approved.length} -> ${now.length}`);
  return { summary: parts.join("; "), lines, before, after };
}

const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

/** The commit the layout is approved at, and whether the runtime or the pages differed from it when it was recorded. */
function approvalMeta() {
  const commit = tryGit("rev-parse", "HEAD");
  let status = "";
  try { status = execFileSync("git", ["-C", repo, "status", "--porcelain", "--", "skills/professional-slides", `${SUITE}/pages`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch { /* not a checkout */ }
  const changed = status.split("\n").filter(Boolean).map((line) => line.slice(3));
  return { commit, clean: changed.length === 0, ...(changed.length ? { uncommitted: changed } : {}) };
}

/**
 * The commits a baseline may have been recorded from, likeliest first: the one layout.meta.json names when the tree was
 * clean at approval, then the last commit of layout.json itself (an approval made over uncommitted runtime work is
 * committed with it), then the named one whatever its state.
 */
function beforeCandidates() {
  const metaFile = path.join(root, "layout.meta.json");
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : null;
  const layoutCommitted = tryGit("diff", "--quiet", "HEAD", "--", `${SUITE}/layout.json`) !== null;
  const lastLayoutCommit = layoutCommitted ? tryGit("log", "-1", "--format=%H", "--", `${SUITE}/layout.json`) : null;
  return [...new Set([meta?.clean ? meta.commit : null, lastLayoutCommit || null, meta?.commit ?? null].filter(Boolean))];
}

/** The gallery compiled by `commit`'s runtime and pages, in a temporary worktree removed afterwards. */
async function compileAtCommit(commit) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "site-gallery-before-"));
  const tree = path.join(scratch, "tree");
  git("worktree", "add", "--detach", "--quiet", tree, commit);
  try {
    const runtime = path.join(tree, "skills/professional-slides/runtime");
    const authoring = await import(pathToFileURL(path.join(runtime, "author-deck.mjs")).href);
    const compiled = await compileGallery(tree, authoring);
    const emitter = fs.existsSync(path.join(runtime, "emit/emit_html.mjs")) ? await import(pathToFileURL(path.join(runtime, "emit/emit_html.mjs")).href) : null;
    return { ...compiled, emitter };
  } finally {
    tryGit("worktree", "remove", "--force", tree);
    fs.rmSync(scratch, { recursive: true, force: true });
    tryGit("worktree", "prune");
  }
}

/** The approved layout's own scene: the first candidate commit that reproduces the moved pages' approved frames. */
async function beforeScene(approved, ids) {
  let best = null;
  for (const commit of beforeCandidates()) {
    let compiled;
    try { compiled = await compileAtCommit(commit); } catch (error) { console.error(`site_gallery: could not compile ${commit.slice(0, 8)}: ${String(error.message).split("\n")[0]}`); continue; }
    const subset = (layout) => Object.fromEntries(ids.filter((id) => layout[id]).map((id) => [id, layout[id]]));
    const differs = moved(subset(approved), subset(compiled.layout));
    const found = { commit, compiled, differs };
    if (!differs.length) return found;
    if (!best || differs.length < best.differs.length) best = found;
  }
  return best;
}

/** Picture paths become data URIs, so a page photographed from `about:blank` still shows its pictures. */
function inlinePictures(slides, baseDir) {
  const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif" };
  for (const node of slides.flatMap((slide) => slide.nodes ?? [])) {
    const data = node.data ?? {};
    if (node.type !== "image" || data.dataUri || node.dataUri || !data.src || /^(data|https?):/.test(data.src)) continue;
    const file = path.isAbsolute(data.src) ? data.src : path.join(baseDir, data.src);
    const type = types[path.extname(file).toLowerCase()];
    if (type && fs.existsSync(file)) data.dataUri = `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
  }
}

/** Photograph each page's first slide: `{ <page id>: png path }`. */
async function photograph(compiled, ids, emitter, directory, baseDir) {
  const { renderHtml } = await import("../../skills/professional-slides/runtime/emit/render_html.mjs");
  const order = ids.filter((id) => compiled.slides[id]?.length);
  if (!order.length) return {};
  const slides = order.map((id) => structuredClone(compiled.slides[id][0]));
  inlinePictures(slides, baseDir);
  const result = await renderHtml(emitter.deckHtml({ ...compiled.deck, slides }, { actual: true }), directory);
  if (result.skipped) throw new Error(result.skipped);
  return Object.fromEntries(order.map((id, at) => [id, result.renders[at]]));
}

const COMPOSE = String.raw`
import json, sys, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
spec = json.loads(Path(sys.argv[1]).read_text())
sys.path.insert(0, spec["emit"])
try:
    from contact_sheet import face, fit, reduce, BACKGROUND, BORDER, INK, MUTED
except Exception:  # the house sheet's helpers moved: plain fonts, full colour
    BACKGROUND, BORDER, INK, MUTED = "#EEF0F2", "#C4C9CE", "#111418", "#555B61"
    def face(kind, size):
        try: return ImageFont.load_default(size=size)
        except TypeError: return ImageFont.load_default()
    def fit(image, width): return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    def reduce(sheet): return sheet
MARK, MARGIN, GAP = "#E0218A", 32, 16

def panel(spec_panel):
    """A 1280x720 page with the moved components outlined and numbered, or a grey card saying why there is none."""
    if spec_panel.get("path"):
        image = Image.open(spec_panel["path"]).convert("RGB")
    else:
        image = Image.new("RGB", (1280, 720), "#D9DCE0")
        ImageDraw.Draw(image).text((40, 330), spec_panel.get("missing", "not drawn"), font=face("bold", 40), fill=MUTED)
    if spec_panel.get("frames"):
        scale = image.width / 1280
        draw = ImageDraw.Draw(image)
        tag = face("bold", round(22 * scale))
        for number, _name, x, y, w, h in spec_panel["frames"]:
            x, y, w, h = (round(v * scale) for v in (x, y, w, h))
            draw.rectangle([x, y, x + max(w, 1), y + max(h, 1)], outline=MARK, width=max(2, round(3 * scale)))
            # The number sits in the frame's top right corner: text is set from the left, so it hides least there.
            label = f"#{number}"
            tw = draw.textlength(label, font=tag)
            right = x + max(w, round(tw + 10))
            draw.rectangle([right - tw - 10, y, right, y + round(26 * scale)], fill=MARK)
            draw.text((right - tw - 5, y + 1), label, font=tag, fill="#FFFFFF")
    return image

def page_sheet(page, out):
    width_each = 800
    panels = [fit(panel(p), width_each) for p in page["panels"]]
    title_font, sub_font, cap_font, line_font = face("bold", 30), face("regular", 19), face("bold", 18), face("mono", 16)
    lines = page["lines"][:28] + ([f"... and {len(page['lines']) - 28} more"] if len(page["lines"]) > 28 else [])
    summary = textwrap.wrap(page["summary"], 150) or [""]
    width = MARGIN * 2 + len(panels) * width_each + GAP * (len(panels) - 1)
    head = MARGIN + 40 + len(summary) * 26 + 10
    body = 28 + max(p.height for p in panels)
    height = head + body + GAP + len(lines) * 22 + MARGIN
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    draw.text((MARGIN, MARGIN), page["id"], font=title_font, fill=INK)
    for i, line in enumerate(summary):
        draw.text((MARGIN, MARGIN + 40 + i * 26), line, font=sub_font, fill=MUTED)
    x = MARGIN
    for spec_panel, image in zip(page["panels"], panels):
        draw.text((x, head), spec_panel["label"], font=cap_font, fill=INK)
        sheet.paste(image, (x, head + 28))
        draw.rectangle([x - 1, head + 27, x + image.width, head + 28 + image.height], outline=BORDER)
        x += width_each + GAP
    y = head + body + GAP
    for line in lines:
        draw.text((MARGIN, y), line, font=line_font, fill=INK)
        y += 22
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    reduce(sheet).save(out, optimize=True)

def index_sheet(index, cells, out):
    thumb, per_row = 340, 2
    cell_width = thumb * 2 + 8
    label_font, note_font = face("mono", 18), face("regular", 15)
    rows = [cells[i:i + per_row] for i in range(0, len(cells), per_row)]
    cell_height = 24 + 20 + round(thumb * 720 / 1280) + 24
    width = MARGIN * 2 + per_row * cell_width + (per_row - 1) * GAP * 2
    height = MARGIN + 80 + len(rows) * cell_height + MARGIN
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    draw.text((MARGIN, MARGIN), index["title"], font=face("bold", 28), fill=INK)
    draw.text((MARGIN, MARGIN + 38), index["subtitle"], font=face("regular", 17), fill=MUTED)
    y = MARGIN + 80
    for row in rows:
        x = MARGIN
        for cell in row:
            draw.text((x, y), cell["id"], font=label_font, fill=INK)
            note = cell["summary"]
            while note and draw.textlength(note, font=note_font) > cell_width:
                note = note[:-4] + "..."
            draw.text((x, y + 24), note, font=note_font, fill=MUTED)
            for k, p in enumerate(cell["panels"][:2]):
                image = fit(panel(p), thumb)
                sheet.paste(image, (x + k * (thumb + 8), y + 44))
                draw.rectangle([x + k * (thumb + 8) - 1, y + 43, x + k * (thumb + 8) + thumb, y + 44 + image.height], outline=BORDER)
            x += cell_width + GAP * 2
        y += cell_height
    reduce(sheet).save(out, optimize=True)

for page in spec["pages"]:
    page_sheet(page, page["out"])
per_index = spec["index"]["perSheet"]
for at, out in enumerate(spec["index"]["outs"]):
    index_sheet(spec["index"], spec["pages"][at * per_index:(at + 1) * per_index], out)
print(json.dumps({"pages": len(spec["pages"]), "index": spec["index"]["outs"]}))
`;

const reference = (id) => {
  const file = path.join(REFERENCES, `${id.replace("-", "__")}.png`);
  return fs.existsSync(file) ? file : null;
};

/** Write the review sheets for every moved page to `out`; returns the review record (also written as `out/review.json`). */
async function writeSheets(approved, now, out = DEFAULT_SHEETS) {
  const ids = moved(approved, now.layout);
  const hash = movesHash(approved, now.layout);
  fs.mkdirSync(out, { recursive: true });
  // Only what an earlier sheet wrote is cleared: the folder may be one the reviewer keeps other things in.
  const previous = path.join(out, "review.json");
  if (fs.existsSync(previous)) for (const file of JSON.parse(fs.readFileSync(previous, "utf8")).files ?? []) fs.rmSync(path.join(out, file), { force: true });
  const record = { hash, moved: ids, before: null, files: [] };
  if (ids.length) {
    const before = await beforeScene(approved, ids);
    record.before = before ? { commit: before.commit, reproduces: !before.differs.length, differsOn: before.differs } : null;
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "site-gallery-sheet-"));
    try {
      const emitter = await import("../../skills/professional-slides/runtime/emit/emit_html.mjs");
      const afterPng = await photograph(now, ids, emitter, path.join(scratch, "after"), path.join(repo, "skills/professional-slides/examples"));
      const beforePng = before ? await photograph(before.compiled, ids, before.compiled.emitter ?? emitter, path.join(scratch, "before"), path.join(repo, "skills/professional-slides/examples")) : {};
      const at = before ? `approved, drawn at ${before.commit.slice(0, 8)}` : "approved";
      const pages = ids.map((id) => {
        const move = describeMove(approved[id], now.layout[id]);
        const refused = now.blocking.find((finding) => String(finding.id) === id);
        if (refused) move.summary += ` - does not compose now (${refused.code}): ${String(refused.repair ?? "").slice(0, 160)}`;
        const unfaithful = before && before.differs.includes(id);
        const panels = [
          { label: unfaithful ? `BEFORE - ${at} (does NOT match the approved frames: outlines are the approved ones)` : `BEFORE - ${at}`, path: beforePng[id] ?? null, frames: move.before, missing: before ? "not in the approved scene" : "no commit reproduces the approved layout" },
          { label: "AFTER - as the runtime draws it now", path: afterPng[id] ?? null, frames: move.after, missing: refused ? "not drawn now: does not compose" : "not drawn now" },
          ...(reference(id) ? [{ label: "PUBLISHED - the image the page was reproduced from", path: reference(id) }] : []),
        ];
        const file = `${id}.png`;
        record.files.push(file);
        return { id, summary: move.summary, lines: move.lines, panels, out: path.join(out, file) };
      });
      const perSheet = 40, outs = [];
      for (let k = 0; k * perSheet < pages.length; k += 1) { const file = k ? `index-${k + 1}.png` : "index.png"; outs.push(path.join(out, file)); record.files.push(file); }
      const spec = { emit: path.join(repo, "skills/professional-slides/runtime/emit"), pages, index: { title: `${ids.length} gallery page${ids.length === 1 ? "" : "s"} moved`, subtitle: `before = ${record.before ? `approved layout, drawn by ${record.before.commit.slice(0, 8)}` : "approved layout (no commit reproduces it)"}; after = now; pink = the components that moved. Moves ${hash}. One sheet a page beside this index.`, perSheet, outs } };
      const specFile = path.join(scratch, "sheet.json");
      fs.writeFileSync(specFile, JSON.stringify(spec));
      const python = process.env.RUNTIME_PYTHON || "python3";
      const run = spawnSync(python, ["-c", COMPOSE, specFile], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(`the sheets were not composed (${python}): ${run.stderr.trim().split("\n").slice(-3).join(" ")}`);
      record.pages = pages.map(({ id, summary, lines, out: file }) => ({ id, summary, lines, sheet: file, reference: Boolean(reference(id)) }));
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }
  record.index = record.files.includes("index.png") ? path.join(out, "index.png") : null;
  fs.writeFileSync(previous, `${JSON.stringify(record, null, 2)}\n`);
  fs.mkdirSync(path.dirname(STAMP), { recursive: true });
  fs.writeFileSync(STAMP, `${JSON.stringify({ hash, moved: ids, sheets: out, index: record.index, written: new Date().toISOString() }, null, 2)}\n`);
  return record;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = path.join(root, "layout.json"), now = await compileGallery(repo);
  const approved = JSON.parse(fs.readFileSync(file, "utf8"));
  if (args.includes("--sheet")) {
    const next = args[args.indexOf("--sheet") + 1];
    const out = next && !next.startsWith("--") ? path.resolve(next) : DEFAULT_SHEETS;
    const record = await writeSheets(approved, now, out);
    console.log(JSON.stringify({ moved: record.moved, moves: record.hash, before: record.before, sheets: out, index: record.index, pages: (record.pages ?? []).map(({ id, summary }) => ({ id, summary })) }, null, 1));
  } else if (args.includes("--approve")) {
    const ids = moved(approved, now.layout), hash = movesHash(approved, now.layout);
    const stamp = fs.existsSync(STAMP) ? JSON.parse(fs.readFileSync(STAMP, "utf8")) : null;
    const looked = !ids.length || (stamp?.hash === hash && (!stamp.index || fs.existsSync(stamp.index)));
    if (!looked && !args.includes("--force")) {
      console.error(JSON.stringify({ refused: `${ids.length} page(s) moved and no sheet of these moves has been written: run \`${SHEET_COMMAND}\`, look at it, then approve (--force records without looking)`, moved: ids, moves: hash, lastSheet: stamp ? { moves: stamp.hash, index: stamp.index } : null }));
      process.exitCode = 1;
    } else {
      fs.writeFileSync(file, `${JSON.stringify(now.layout)}\n`);
      fs.writeFileSync(path.join(root, "layout.meta.json"), `${JSON.stringify(approvalMeta(), null, 1)}\n`);
      console.log(JSON.stringify({ approved: Object.keys(now.layout).length, moved: ids, sheet: looked && ids.length ? stamp.index : null, forced: !looked, blocking: now.blocking }));
    }
  } else {
    const changed = moved(approved, now.layout);
    console.log(JSON.stringify({ pages: now.pages.length, moved: changed, blocking: now.blocking, ...(changed.length ? { review: SHEET_COMMAND } : {}) }));
    process.exitCode = changed.length || now.blocking.length ? 1 : 0;
  }
}
