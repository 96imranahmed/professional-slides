#!/usr/bin/env node
/**
 * Stands in for a deck reviewer in the calibration's tests. It reads the
 * staged deck-review packet it was handed (its working directory) and answers
 * with a valid first pass, the way a CLI in JSON mode would: every page it
 * was given read on every page dimension, nothing found.
 *
 * FAKE_REVIEWER_FINDING=1 files one major finding on the first page, in the
 * form the packet's prompt describes: a title that claims more than the page
 * shows, whose repair is the title. The rating wobbles with the repeat
 * (CRITIC_CALIBRATION_RUN) by 0.2, so the harness has a spread to measure.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const packet = JSON.parse(readFileSync(path.join(process.cwd(), "packet.json"), "utf8"));
const read = packet.revision ? packet.revision.changed : packet.slides.map((slide) => slide.id);
const page = packet.slides.find((slide) => read.includes(slide.id));
const findings = process.env.FAKE_REVIEWER_FINDING === "1" ? [{ id: "F1", scope: "page", slides: [page.id], dimension: "argument", code: "UNSUPPORTED_CLAIM", severity: "major",
  reason: "The title says the subject leads on every measure and the page shows one measure.", repair: "Rewrite the title to the one measure the page shows.", touches: ["title"], checkable: null }] : [];
const dimensions = Object.keys(packet.rubric), pageDimensions = dimensions.filter((d) => packet.rubric[d].scope === "page");
const run = Number(process.env.CRITIC_CALIBRATION_RUN ?? 1);
const review = { pass: 1, verifies: null, accepted: !findings.length, summary: findings.length ? "The deck argues its answer; one title outruns its page." : "The deck argues its answer and every page proves its title.",
  rating: Math.round(((findings.length ? 7 : 8.4) - 0.2 * ((run % 3) - 1)) * 10) / 10, binding: packet.binding, opened: read, provenance: { backend: "subagent", model: "fake-reviewer", promptHash: packet.promptHash },
  pages: read.map((id) => ({ slide: id, verdict: findings.some((f) => f.slides.includes(id)) ? "major" : "ok", checks: Object.fromEntries(pageDimensions.map((d) => [d, `checked ${d} on the page`])) })), findings,
  completeness: dimensions.map((dimension) => (findings.some((f) => f.dimension === dimension) ? { dimension, result: "findings", note: "Filed F1 on the title." } : { dimension, result: "clean", note: `Checked ${dimension} on every page given and found nothing to raise.` })),
  assessment: Object.fromEntries(["argument", "evidence", "visual", "copy", "sequence", "bestPage", "worstPage", "mostRepetitive", "mostDeletable"].map((key) => [key, `A sentence about ${key}.`])),
  density: { deck: "No density profile was built for this fixture, so no medians are compared.", pages: [] } };
process.stdout.write(JSON.stringify({ type: "result", result: JSON.stringify(review) }));
