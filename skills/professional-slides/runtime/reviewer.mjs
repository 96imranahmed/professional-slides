// Model review behind an interface. One prompt, one schema, a visual vocabulary that
// is allowed to block, and a `repair` that has to be a sentence. Backends:
//   codex   — `codex exec --image … --output-schema`  (OpenAI Codex CLI)
//   claude  — `claude -p … --output-format json`       (Claude Code CLI; reads the PNGs itself)
//   packet  — no model call: writes review-packet/ for the calling agent to review and
//             answer with `deliver-deck.mjs … --review review.json`. This is the default
//             inside an agent session, where the agent *is* the reviewer.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process.mjs";

export const SEVERITIES = ["none", "minor", "major", "blocker"];
export const CODES = Object.freeze({
  // facts and evidence
  FACTUAL_ERROR: "a stated number, name or date is wrong",
  UNSUPPORTED_CLAIM: "a claim the cited evidence does not support",
  MISLEADING_COMPARISON: "values compared across incompatible bases without saying so",
  MISSING_EVIDENCE: "a ranked criterion or stated requirement has no comparative evidence",
  MISSING_ARGUMENT: "the page's purpose or necessary inference is unclear from its title, evidence and commentary together",
  // legibility and geometry
  UNREADABLE: "text too small, clipped or low-contrast to read",
  OVERFLOW: "content exceeds its box or the slide",
  BROKEN_GEOMETRY: "misaligned, overlapping or orphaned elements",
  PROVENANCE: "a number or claim with no traceable source, basis or as-at date",
  // design — these block too
  DEAD_SPACE: "a large empty band the page does nothing with",
  LAYOUT_MONOTONY: "the same page construction repeated across most of the deck",
  NO_HERO_EXHIBIT: "an analytical page with no dominant exhibit",
  OVERSIZED_TYPE: "body or chart type set larger than a reader expects on a slide",
  WALL_OF_TEXT: "prose doing the work an exhibit should do",
  BURIED_NUMBER: "a decisive number in a sentence instead of on a mark",
  HEDGED_TITLE: "an action title that does not commit to a finding",
  TITLE_TOO_LONG: "an action title over two lines",
  INCONSISTENT_ENCODING: "the same measure encoded differently across pages",
  // beautification - the pass a threshold cannot make
  NO_VISUAL_ANCHOR: "recognition or visible evidence matters, but the page supplies no useful visual anchor",
  UNANNOTATED_PLOT: "a necessary comparison or threshold is difficult to locate without an annotation",
  TABLE_MONOTONY: "repeated table grammar obscures a meaningful difference in evidence relationships",
  MIXED_GRAMMAR: "different evidence grammars share a page without a clear relationship or reading order",
  DECORATION: "a rule, band or device that separates nothing and says nothing",
  NARROW_REPERTOIRE: "the deck draws on a handful of exhibits where its evidence has many shapes",
  // density - the review's pass over the rendered density profile
  DENSITY_MISMATCH: "a page's words are thinner, denser or differently shaped than the client pages doing its job, and it shows",
  EDITORIAL: "a wording preference"
});

// A flagged page is right, or it is wrong in one of three ways. Only "right"
// lets the deck through: the profile's flag is a question, the verdict is the
// answer, and a padded page that cleared the hard floor is answered here.
export const DENSITY_VERDICTS = Object.freeze(["right", "too thin", "too dense", "wrong shape"]);

export const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["accepted", "summary", "findings", "binding", "inspectedSlides", "rating", "density"],
  properties: {
    // The density pass: the rendered pages measured the way the corpus was
    // (density-profile.json), judged. `deck` compares the deck's medians with
    // the client targets; `pages` holds a verdict for every flagged page.
    density: {
      type: "object", additionalProperties: false, required: ["deck", "pages"],
      properties: {
        deck: { type: "string", minLength: 40 },
        pages: {
          type: "array",
          items: {
            type: "object", additionalProperties: false, required: ["slide", "verdict", "reason"],
            properties: {
              slide: { type: "string" },
              verdict: { type: "string", enum: DENSITY_VERDICTS },
              reason: { type: "string", minLength: 20 }
            }
          }
        }
      }
    },
    binding: { type: "string", pattern: "^[a-f0-9]{64}$" },
    inspectedSlides: { type: "array", items: { type: "string" } },
    rating: { type: "number", minimum: 0, maximum: 10 },
    accepted: { type: "boolean" },
    summary: { type: "string", minLength: 20 },
    findings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["slide", "code", "severity", "reason", "repair"],
        properties: {
          slide: { type: ["string", "null"] },
          code: { type: "string", pattern: "^[A-Z][A-Z0-9_]+$" },
          severity: { type: "string", enum: SEVERITIES },
          reason: { type: "string", minLength: 20 },
          repair: { type: "string" }
        }
      }
    }
  }
};

export function validateReview(review, slideIds) {
  const errors = [];
  if (!review || typeof review !== "object") return ["review is not an object"];
  if (typeof review.accepted !== "boolean") errors.push("accepted must be boolean");
  if (typeof review.summary !== "string" || review.summary.trim().length < 20) errors.push("summary must be a sentence");
  if (!Array.isArray(review.findings)) return [...errors, "findings must be an array"];
  const known = new Set(slideIds);
  for (const [i, f] of review.findings.entries()) {
    const at = `findings[${i}]`;
    if (f.slide !== null && !known.has(f.slide)) errors.push(`${at}: unknown slide ${f.slide}`);
    if (!/^[A-Z][A-Z0-9_]+$/.test(f.code ?? "")) errors.push(`${at}: invalid code ${f.code}`);
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}: unknown severity ${f.severity}`);
    if (["major", "blocker"].includes(f.severity)) {
      if (f.code === "EDITORIAL") errors.push(`${at}: EDITORIAL cannot be ${f.severity}`);
      if (typeof f.repair !== "string" || f.repair.trim().length < 40 || !/\b(add|replace|move|merge|cut|rewrite|split|show|plot|label|reduce|enlarge|use|drop|state|cite)\b/i.test(f.repair)) errors.push(`${at}: a ${f.severity} finding needs a concrete repair sentence`);
    }
  }
  const blocking = review.findings.some((f) => ["major", "blocker"].includes(f.severity));
  if (review.accepted && blocking) errors.push("accepted cannot be true with major or blocker findings");
  return errors;
}


/** Bind a visual review to the exact editable file, scene and rendered pages. */
export async function reviewBinding(directory) {
  const scene = JSON.parse(await fs.readFile(path.join(directory, "scene.json"), "utf8"));
  const result = JSON.parse(await fs.readFile(path.join(directory, "build-result.json"), "utf8"));
  const files = ["scene.json", path.relative(directory, result.pptxPath),
    ...scene.slides.map((_, i) => `rendered/slide-${i + 1}.png`)];
  const hash = createHash("sha256");
  for (const file of files) { hash.update(file); hash.update(await fs.readFile(path.join(directory, file))); }
  return hash.digest("hex");
}

export async function validateReviewBinding(review, directory, slideIds) {
  const errors = [];
  if (review.binding !== await reviewBinding(directory)) errors.push("Review does not match the current PPTX, scene and renders");
  const inspected = Array.isArray(review.inspectedSlides) ? review.inspectedSlides : [];
  const seen = new Set(inspected);
  if (inspected.length !== slideIds.length || seen.size !== slideIds.length || slideIds.some(id => !seen.has(id))) errors.push("Review must record inspection of every current slide");
  if (!Number.isFinite(review.rating) || review.rating < 0 || review.rating > 10) errors.push("Review must provide a rating from zero to ten");
  return errors;
}

/**
 * The density pass is complete: the deck comparison is written and every page
 * the profile flagged has a verdict. A review without it cannot accept a deck
 * whose rendered words were never compared with the client pages.
 */
export function validateDensityReview(review, profile) {
  if (!profile) return [];
  const errors = [];
  const density = review?.density;
  if (!density || typeof density !== "object") return ["Review must carry the density pass (density.deck and density.pages)"];
  if (typeof density.deck !== "string" || density.deck.trim().length < 40) errors.push("density.deck must compare the deck's measured medians with the client targets");
  const pages = Array.isArray(density.pages) ? density.pages : [];
  for (const [i, entry] of pages.entries()) {
    if (!DENSITY_VERDICTS.includes(entry?.verdict)) errors.push(`density.pages[${i}]: verdict must be one of ${DENSITY_VERDICTS.join(", ")}`);
    if (typeof entry?.reason !== "string" || entry.reason.trim().length < 20) errors.push(`density.pages[${i}]: give the reason for the verdict`);
  }
  const judged = new Set(pages.map((entry) => entry?.slide));
  const missing = (profile.flaggedPages || []).filter((id) => !judged.has(id));
  if (missing.length) errors.push(`density pass must judge every flagged page; missing ${missing.join(", ")}`);
  return errors;
}

export function reviewOutcome(review) {
  const blocking = (review.findings || []).filter((f) => ["major", "blocker"].includes(f.severity));
  // A density verdict other than "right" blocks as a finding would.
  for (const entry of review.density?.pages || []) {
    if (entry.verdict === "right") continue;
    blocking.push({ slide: entry.slide, code: "DENSITY_MISMATCH", severity: "major", reason: `${entry.verdict}: ${entry.reason}`,
      repair: "Rewrite the page to the density of the client pages doing its job: add the missing reasoning, cut the padding, or split the long block into points" });
  }
  return { accepted: review.accepted === true && blocking.length === 0, blocking };
}

function textOf(slide) {
  return slide.nodes.filter((n) => n.type === "text" && !["page-number", "source-text"].includes(n.role)).map((n) => ({ role: n.role, text: (n.data?.textLayout?.source ?? n.text) }));
}

export async function buildReviewPacket({ outputDirectory, brief = "", answer = "" }) {
  const dir = path.resolve(outputDirectory);
  const scene = JSON.parse(await fs.readFile(path.join(dir, "scene.json"), "utf8"));
  const gates = await fs.readFile(path.join(dir, "gates.json"), "utf8").then(JSON.parse).catch(() => ({ findings: [] }));
  const packetDir = path.join(dir, "review-packet");
  await fs.mkdir(packetDir, { recursive: true });
  const slides = scene.slides.map((s, i) => ({
    id: s.id, index: i + 1,
    title: s.nodes.find((n) => n.role === "action-title" || n.role === "cover-title")?.text?.replace(/\n/g, " ") ?? "",
    text: textOf(s),
    exhibits: (s.componentInstances || []).filter((c) => /^(chart\.|table|image-frame|metric)/.test(c.component)).map((c) => ({ component: c.component, frame: c.frame })),
    gateFindings: (gates.findings || []).filter((f) => f.slide === s.id || f.slide === i + 1),
    image: path.join(dir, "rendered", `slide-${i + 1}.png`)
  }));
  const statistics = designStatistics(scene);
  const density = await fs.readFile(path.join(dir, "density-profile.json"), "utf8").then(JSON.parse).catch(() => null);
  const packet = { binding: await reviewBinding(dir), inspectedSlides: slides.map(s => s.id), statistics, density, brief, answer, montage: path.join(dir, "rendered", "montage.png"), titles: slides.map((s) => `${s.index}. ${s.title}`), slides, codes: CODES, schema: REVIEW_SCHEMA };
  await fs.writeFile(path.join(packetDir, "packet.json"), JSON.stringify(packet, null, 2));
  await fs.writeFile(path.join(packetDir, "schema.json"), JSON.stringify(REVIEW_SCHEMA, null, 2));
  await fs.writeFile(path.join(packetDir, "prompt.md"), reviewPrompt(packet));
  return { packetDir, packet };
}

/** Descriptive diagnostics for corpus analysis; not editorial targets or reference proof. */
export function designStatistics(scene) {
  // Counts describe rendered devices, not whether their semantic use is appropriate. `page_gates.py` holds the same list, because the
  // build has to be able to refuse a deck and the build reads that file.
  const TREATMENT = /^table-(bubble|bar|rating-|implication|column-band|row-band|zebra-band|harvey|status-pill|number-circle|lamp|dot|check|progress-|cell-icon|section-marker|section-number)/;
  const ANNOTATION = /^(annotation-|chart-(bracket|delta|event-|highlight|reference|band|callout|change))/;
  const content = scene.slides.filter((s) => s.nodes.some((n) => n.role === "action-title"));
  const kinds = new Set();
  let tables = 0, treated = 0, charts = 0, annotated = 0, marks = 0, unsourced = 0;
  for (const slide of content) {
    const components = (slide.componentInstances || []).map((c) => String(c.component));
    for (const c of components) if (!["chrome", "section", "page-template"].includes(c)) kinds.add(c);
    const roles = slide.nodes.map((n) => String(n.role ?? ""));
    // "Drawings", the way the corpus counts them: every primitive that is not
    // type. A published analytical page carries 32 (p25 11, p75 88); a page of rules and text
    // carries very few, which is the difference a reader feels first.
    marks += slide.nodes.filter((n) => n.type !== "text").length;
    // An empty picture frame: a photograph written as `alt` with no `path`. It
    // is how a page gets laid out before its pictures are cleared, and it is
    // not how a deck is delivered - so it is counted, not assumed away.
    unsourced += slide.nodes.filter((n) => String(n.role ?? "") === "image-frame").length;
    if (components.some((c) => /^(table|comparison-table|heatmap|trend-rows)$/.test(c))) {
      tables += 1;
      if (roles.some((r) => TREATMENT.test(r))) treated += 1;
    }
    if (components.some((c) => c.startsWith("chart."))) {
      charts += 1;
      // A recoloured category draws no node of its own - the mark keeps its
      // role and carries `highlighted` - and it is the commonest mark there is.
      const recoloured = slide.nodes.some((n) => n.data?.highlighted);
      if (recoloured || roles.some((r) => ANNOTATION.test(r))) annotated += 1;
    }
  }
  const round = (n) => Math.round(n * 100) / 100;
  return {
    contentPages: content.length,
    exhibitVarietyPerTen: content.length ? round((kinds.size / content.length) * 10) : 0,
    distinctExhibits: kinds.size,
    unsourcedPictures: unsourced,
    tables, tablesTreated: tables ? round(treated / tables) : null,
    charts, chartsAnnotated: charts ? round(annotated / charts) : null,
    drawingsPerPage: content.length ? round(marks / content.length) : 0,
    reference: { exhibitVarietyPerTen: "7.1 to 8.3", tablesTreated: 0.89, chartsAnnotated: 0.63, drawingsPerPage: 32 },
  };
}

export function reviewPrompt(packet) {
  // Historical corpus aggregates remain available to analysis callers, not as review targets.
  const { reference: historicalReference, ...candidateStatistics } = packet.statistics || {};
  const guidance = ["storylining", "design", "taste-review"].map(name => fileURLToPath(new URL(`../references/${name}.md`, import.meta.url)));
  return `You are reviewing a consulting deck against the client's brief. Look at every rendered slide image and the montage; read the text. Judge it the way an engagement manager would the night before a steering committee.

Read these skill files before assessing: ${guidance.join(", ")}. The taste-review guidance owns benchmark calibration and literal coverage. Do not consult prior candidate scores, repair lists or peer status summaries.

BRIEF: ${packet.brief || "(not supplied)"}
GOVERNING ANSWER: ${packet.answer || "(not supplied)"}

TITLES ALONE (read as a memo — does the argument flow?):
${packet.titles.join("\n")}

For each slide, decide whether a reader gets the finding from the title and can verify it from the exhibit. A separate soWhat or closing strip is optional: the title and exhibit may already complete the argument. Two distinct insights can share a page when each is supported and clearly placed. Flag redundant propositions or competing summary boxes, not the absence of a footer conclusion or the mere presence of multiple insights. Use these codes where appropriate, or a precise upper-case code for a newly observed defect:
${Object.entries(packet.codes).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Severity: blocker (must fix before any reader sees it), major (fix before delivery), minor (advisory), none. Design codes (DEAD_SPACE, LAYOUT_MONOTONY, NO_HERO_EXHIBIT, OVERSIZED_TYPE, WALL_OF_TEXT, BURIED_NUMBER, HEDGED_TITLE, TITLE_TOO_LONG, INCONSISTENT_ENCODING) may be major. A large empty band, one layout repeated across most pages, and prose where an exhibit belongs are defects, not preferences. Every major or blocker finding needs a repair sentence saying exactly what to add, replace, move, merge, cut, plot or rewrite.

Deterministic gate findings already computed (confirm, refine or explain why they do not matter):
${packet.slides.flatMap((s) => s.gateFindings.map((f) => `- slide ${s.index} ${f.code}: ${f.measured ?? ""} (threshold ${f.threshold ?? ""})`)).join("\n") || "- none"}

Slide images: ${packet.slides.map((s) => s.image).join(", ")}
Montage: ${packet.montage}

VISUAL REVIEW. Inspect every original page at full size, every spread and the montage. Follow the semantic checks in references/design.md: coherent argument and counts; reconciled totals, periods, sample membership and durations; scoped comparisons, non-causal wording unless supported, and reversal conditions that affect the named option; focus that supports the claim; appropriate table category/dimension grammar; one chart heading owner; consistent qualifiers; vertically balanced sparse groups; meaningful arrows and rules; and cross-slide consistency. Neutral charts, joined verdicts, optional commentary and repeated comparison layouts are valid. Do not require pictures, icons, highlights or layout variety to meet quotas. Record concrete defects, not preferences.

Candidate diagnostics, not quality targets:
${JSON.stringify(candidateStatistics, null, 1)}

Compare strong relevant original pages from every requested reference deck before scoring. Record exact pages inspected and missing coverage in a companion assessment. Historical aggregate device counts do not establish a benchmark. Explain concrete differences in evidence relationships and reader effort; do not infer quality from more devices or annotations. Compare substantive text against matched reading tasks, preserving necessary explanation without padding.

Name the best page, worst page and most repetitive sequence. Challenge the most deletable page with a concrete merger and identify any lost evidence. Reproduce material calculations from supplied source records; disclose unverified assumptions. Record argument, evidence, visual explanation, hierarchy/copy and sequence quality in the companion assessment.

${densityPrompt(packet.density)}

After inspecting them, record inspectedSlides from these IDs: ${JSON.stringify(packet.inspectedSlides)}. Bind this review to ${packet.binding}. Rate the actual deck out of ten independently of any requested target. A passing gate is not a taste score.

Return ONLY JSON matching this schema: ${JSON.stringify(packet.schema)}
Set accepted=false if any finding is major or blocker. The summary is two sentences: what the deck does well and what must change.`;
}

/** The density pass: the profile's comparison and flags, put to the reviewer as questions. */
export function densityPrompt(profile) {
  if (!profile) return "DENSITY PASS. No density profile was built (the deck was not rendered); set density to {\"deck\": \"No rendered density profile was available for this build.\", \"pages\": []}.";
  const deck = profile.deck || {};
  const line = (name, label) => deck[name] ? `- ${label}: ${deck[name].measured} against the client ${deck[name].target} (band ${JSON.stringify(deck[name].band ?? null)}), ${deck[name].position}` : null;
  const flagged = (profile.pages || []).filter((p) => p.flags?.length);
  return `DENSITY PASS. The rendered pages were measured the way the client corpus was (pdftotext -layout; title and source lines excluded; a block is a run of lines between blank ones; blocks under three words are labels). Compare the deck with the client targets, then open every flagged page and judge whether its density is right for the job it does. A flag is a question, not a verdict: a chart-led page may rightly sit light, and a page that clears its word floor with padding or restatement is too dense or the wrong shape even though it passed. Deck against client pages (block measures over the ${deck.comparedPages ?? "?"} pages that carry commentary or prose, the population the benchmark measured; ${deck.exhibitLed?.pages ?? 0} exhibit-led pages sit beside them at ${deck.exhibitLed?.wordsPerBlock ?? "-"} words a block, which are labels):
${[line("bodyWordsVsTaskMedian", "body words against each page's task median (1.0 = client median)"), line("blocksPerPage", "text blocks per page"), line("wordsPerBlock", "words per block"), line("longestBlock", "longest block per page"), deck.singleBlockShare ? `- single-block pages: ${deck.singleBlockShare.measured} of pages against at most ${deck.singleBlockShare.target}` : null].filter(Boolean).join("\n")}
Flagged pages:
${flagged.map((p) => `- ${p.id} (page ${p.page}, ${p.task ?? "no task"}): ${p.flags.join("; ")}`).join("\n") || "- none"}
Record density.deck as two or three sentences comparing the deck's medians with the client targets and saying what that means for a reader, and density.pages as one verdict per flagged page (right, too thin, too dense or wrong shape) with the reason you saw on the page. Any verdict other than right blocks delivery.`;
}

function hasCli(name) { return spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0; }

export function detectBackend(preferred = "auto") {
  if (preferred !== "auto") return preferred;
  if (process.env.PS_REVIEWER) return process.env.PS_REVIEWER;
  if (hasCli("codex")) return "codex";
  if (hasCli("claude")) return "claude";
  return "packet";
}

export async function runReview({ outputDirectory, brief, answer, backend = "auto", model, timeoutMs = 600000 }) {
  const { packetDir, packet } = await buildReviewPacket({ outputDirectory, brief, answer });
  const which = detectBackend(backend);
  const prompt = await fs.readFile(path.join(packetDir, "prompt.md"), "utf8");
  const reviewPath = path.join(path.resolve(outputDirectory), "review.json");
  let raw;
  if (which === "packet") {
    return { backend: "packet", status: "packet-written", packetDir, reviewPath, note: `Review the packet at ${packetDir} (prompt.md + images) and write ${reviewPath}, then rerun deliver-deck with --review ${reviewPath}` };
  }
  if (which === "codex") {
    const out = path.join(packetDir, "codex-last-message.json");
    const args = ["exec", ...(model ? ["--model", model] : []), "--sandbox", "read-only", "--ephemeral", "--output-schema", path.join(packetDir, "schema.json"), "--output-last-message", out, ...packet.slides.flatMap((s) => ["--image", s.image]), "--image", packet.montage, "-"];
    await runProcess("codex", args, { input: prompt, timeoutMs });
    raw = await fs.readFile(out, "utf8");
  } else if (which === "claude") {
    const res = await runProcess("claude", ["-p", "--output-format", "json", "--allowedTools", "Read", ...(model ? ["--model", model] : [])], { input: prompt, timeoutMs });
    const envelope = JSON.parse(res.stdout);
    raw = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? envelope);
  } else throw new Error(`Unknown reviewer backend: ${which}`);
  const match = String(raw).match(/\{[\s\S]*\}/);
  const review = JSON.parse(match ? match[0] : raw);
  review.backend = which; review.model = model || null;
  await fs.writeFile(reviewPath, JSON.stringify(review, null, 2) + "\n");
  return { backend: which, status: "reviewed", reviewPath, review };
}
