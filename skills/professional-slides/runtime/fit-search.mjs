// The fit search: when a page does not fit the layout its choices set, the
// compiler tries the other layouts its type allows, with the same content.
//
// A page that does not compose, leaves a band empty or falls short of its
// word floor is usually one choice away from fitting - points under the
// exhibit rather than beside it, a gantt rather than a timeline - and finding
// that choice by hand costs a whole compile a try. So for every page with a
// blocking layout finding (gates/gate_classes.mjs LAYOUT_CODES) this compiles
// each other form and commentary placement of the page's type from the page
// as written, composes the ones that compile in the deck's own context, runs
// them through the page-local gates the page itself answers, and checks the
// deck's structure rules with the page swapped. The finding then lists which
// alternatives pass, which fail and on what, and which need content the page
// does not carry. Nothing is applied: the author chooses.
//
// "The same content" is checked, not assumed. A form may compile from a page
// and draw only part of it - a cycle's `center` means nothing to a row of
// steps - so an alternative that clears every gate is then asked which of the
// page's fields it draws: each field the page's own form uses is taken out in
// turn, and a field whose removal leaves the alternative's composed page
// exactly as it was is one the alternative ignores. Such an alternative is
// listed apart, with the fields it drops, and never among the verified passes.
// No list of which form reads which field is kept: the composition says.
//
// The search is bounded by count, never by the clock, so the same deck gets
// the same answer on a loaded machine: at most `perPage` alternatives are
// composed for a page, and what was left untried is said. Alternatives are
// composed a round at a time - round n swaps every page for its nth
// alternative in one deck - and all their pages go through the page gates in
// one call.
import { PAGE_TYPES, placementsOf, withChoice } from "./page-types.mjs";

export const FIT = Object.freeze({ perPage: 6 });

/**
 * Every other form and commentary placement the catalogue allows the page's
 * type, nearest first: the same form with another placement, another form
 * with the same placement, then the rest.
 */
export function alternativeChoices(page) {
  const type = PAGE_TYPES[page?.type];
  if (!type || !Object.hasOwn(type.forms, page.form ?? "")) return [];
  const others = Object.keys(type.forms).filter((form) => form !== page.form);
  return [
    ...placementsOf(page.type, page.form).filter((commentary) => commentary !== page.commentary).map((commentary) => ({ form: page.form, commentary })),
    ...others.filter((form) => placementsOf(page.type, form).includes(page.commentary)).map((form) => ({ form, commentary: page.commentary })),
    ...others.flatMap((form) => placementsOf(page.type, form).filter((commentary) => commentary !== page.commentary).map((commentary) => ({ form, commentary }))),
  ];
}

// A page's own choices: what an alternative changes, not content it could drop.
const CHOICES = new Set(["id", "type", "form", "commentary"]);

/**
 * The fields a page wrote, each as `{ path, without(page) }`: every key of
 * the page beyond its choices, every key of each of its exhibits, and every
 * key the entries of a list in an exhibit carry (an item's `text`, a series'
 * `name`) taken across the whole list.
 */
export function writtenFields(page) {
  const fields = [];
  const add = (path, remove) => fields.push({ path, without: (from) => { const copy = structuredClone(from); remove(copy); return copy; } });
  for (const key of Object.keys(page)) if (!CHOICES.has(key)) add(key, (copy) => { delete copy[key]; });
  const exhibits = [["exhibit", (p) => p.exhibit], ...(Array.isArray(page.exhibits) ? page.exhibits.map((_, i) => [`exhibits[${i}]`, (p) => p.exhibits?.[i]]) : []),
    ...(Array.isArray(page.blocks) ? page.blocks.map((_, i) => [`blocks[${i}].exhibit`, (p) => p.blocks?.[i]?.exhibit]) : [])];
  for (const [at, find] of exhibits) {
    const ex = find(page);
    if (!ex || typeof ex !== "object" || Array.isArray(ex)) continue;
    for (const key of Object.keys(ex)) {
      // The exhibit's `type` is the form's to set (page-types.mjs withChoice).
      if (key === "type") continue;
      add(`${at}.${key}`, (copy) => { const target = find(copy); if (target) delete target[key]; });
      const list = ex[key];
      if (!Array.isArray(list) || !list.length || !list.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) continue;
      for (const inner of new Set(list.flatMap((entry) => Object.keys(entry))))
        add(`${at}.${key}[].${inner}`, (copy) => { for (const entry of find(copy)?.[key] ?? []) if (entry && typeof entry === "object") delete entry[inner]; });
    }
  }
  return fields;
}

/**
 * The fields of `page` that `alt` - the page under another form or placement -
 * does not draw, by path. `drawn(page, index)` composes one page on its own
 * and returns `{ slide, scene }`: the compiled slide and the composed page, as
 * text, each null where the page does not get that far.
 *
 * A field is content where the page's own form uses it: taking it out changes
 * the page as its form composes it (or, where that form does not compose, the
 * slide it compiles to; a field the form cannot compile without is used). The
 * alternative drops such a field when taking it out changes nothing of the
 * alternative's composed page. An alternative that does not compose on its
 * own cannot be checked, and is said to be unchecked rather than passed.
 */
async function droppedFields(page, alt, index, drawn) {
  const own = await drawn(page, index), other = await drawn(alt, index);
  if (other.scene === null) return ["(the alternative could not be composed on its own, so what it draws of the page was not checked)"];
  const dropped = [];
  for (const field of writtenFields(page)) {
    const less = await drawn(field.without(page), index);
    const used = own.scene !== null ? less.scene !== own.scene : less.slide !== own.slide;
    if (used && (await drawn(field.without(alt), index)).scene === other.scene) dropped.push(field.path);
  }
  // A list's key and the keys of its entries: where the whole list is dropped, its entries' keys say nothing more.
  return dropped.filter((path) => !dropped.some((whole) => path.startsWith(`${whole}[].`)));
}

const idOfMessage = (message) => String(message).match(/^(?:Cannot render )?([^:\s]+):/)?.[1];
const withoutId = (message, id) => { const text = String(message); return text.startsWith(`${id}: `) ? text.slice(id.length + 2) : text; };

/**
 * Search the alternatives of each of `targets` - `[{ id, page, index }]`, the
 * authored pages with a blocking layout finding. The deck's own machinery
 * comes in as functions, so an alternative meets exactly the checks the page
 * did:
 *
 *   compile(page, index)        the compiled slide, or throws with the refusal
 *   compose(spec)               `{ deck, pageErrors, error }` for a deck spec
 *   pageGates(deck)             the page gates' findings for a composed deck
 *   localFindings(spec, deck, pages)  the other page-local findings, `pages`
 *                               the authored pages swapped in, by id
 *   structure(id, slide)        the structure rules that swapping the page's
 *                               slide for `slide` would newly break
 *   drawn(page, index)          one authored page compiled and composed on its
 *                               own, as `{ slide, scene }` text (null where it
 *                               does not compile or compose): what tells which
 *                               of the page's fields an alternative draws
 *   brief(finding)              a finding in a phrase, with by how much
 *   aggregate(id, blocks)       what swapping the page for an alternative whose
 *                               text sets in `blocks` (the page budget's block
 *                               estimate) would do to a deck aggregate read off
 *                               the pages' text, as phrases: an alternative that
 *                               takes the deck out of a band is not proposed
 *
 * `known(target)` returns a page's verdicts from an earlier run, or null, and
 * `learned(target, verdicts)` takes them; the verdicts hold only what the
 * page-local checks found, and the structure rules are read again each run.
 * Returns a map from page id to `{ pass, partial, fail, needs, untried,
 * capped }`: `pass` the alternatives that fit and draw every field the page
 * wrote, `partial` the ones that fit only by dropping some (`drops`).
 *
 * What "fit" rests on is the scene: the composition and the gates that read
 * it. A render can still refuse a page the scene passes - text an exported
 * shape loses, a band only the pixels show - so a pass is reported as a pass
 * of the scene checks until the caller renders it (author-deck.mjs
 * `--check --render`), which marks each one it rendered (`rendered`) or moves
 * it to `fail` with what the render refused.
 */
export async function fitSearch(targets, { spec, deck, compile, compose, pageGates, localFindings, structure, brief, drawn = null, aggregate = null, known = () => null, learned = () => {},
  perPage = FIT.perPage }) {
  const plans = targets.map((target) => {
    const tryable = [], refused = new Map();
    for (const choice of alternativeChoices(target.page)) {
      const page = withChoice(target.page, choice.form, choice.commentary);
      try { tryable.push({ ...choice, page, slide: compile(page, target.index) }); }
      // An alternative that does not compile from the page as written needs content the page lacks: its refusal says what.
      catch (error) { const needs = withoutId(error.message, target.id); refused.set(needs, [...(refused.get(needs) || []), choice]); }
    }
    const verdicts = known(target);
    return { ...target, tried: tryable.slice(0, perPage), beyond: tryable.slice(perPage), needs: [...refused].map(([needs, choices]) => ({ choices, needs })), verdicts };
  });
  // Round n: every page still to be searched takes its nth alternative, in one deck.
  const searching = plans.filter((plan) => !plan.verdicts);
  const rounds = Math.max(0, ...searching.map((plan) => plan.tried.length));
  const variants = [];
  for (let round = 0; round < rounds; round += 1) {
    const swaps = new Map(searching.filter((plan) => plan.tried[round]).map((plan) => [plan.id, plan.tried[round]]));
    const swap = (list) => (list || []).map((slide) => swaps.get(slide.id)?.slide ?? slide);
    const variant = { ...spec, slides: swap(spec.slides), ...(spec.appendix ? { appendix: swap(spec.appendix) } : {}) };
    variants.push({ swaps, spec: variant, composed: await compose(variant) });
  }
  // Every alternative's composed pages, gated in one call. The deck's first
  // page leads the batch, so the gates place no alternative as a cover.
  const batch = [], owners = [];
  variants.forEach((variant, round) => {
    for (const [id] of variant.swaps) for (const slide of (variant.composed.deck?.slides || []).filter((s) => (s.sourceSlideId ?? s.id) === id)) { batch.push(slide); owners.push(`${round}|${id}`); }
  });
  const anchor = deck?.slides?.[0] ?? variants.find((v) => v.composed.deck)?.composed.deck.slides[0];
  const gated = batch.length ? pageGates({ ...(deck ?? variants.find((v) => v.composed.deck).composed.deck), slides: [anchor, ...batch] }) : { ran: true, findings: [] };
  const blocking = (f) => ["blocker", "blocking"].includes(f.severity);
  const gateFindings = new Map();
  for (const f of (gated.findings || []).filter((x) => blocking(x) && x.slide >= 2)) { const key = owners[f.slide - 2]; gateFindings.set(key, [...(gateFindings.get(key) || []), f]); }
  // Each alternative's text blocks as the page budget estimates them, by the page that owns them (its first slide where it runs to two).
  const blocksOf = new Map();
  for (const row of gated.budget || []) { const key = owners[row.slide - 2]; if (key !== undefined && row.blocks && !blocksOf.has(key)) blocksOf.set(key, row.blocks); }
  variants.forEach((variant) => {
    variant.local = variant.composed.deck ? localFindings(variant.spec, variant.composed.deck, new Map([...variant.swaps].map(([id, alt]) => [id, alt.page]))).filter(blocking) : [];
  });

  const out = new Map();
  for (const plan of plans) {
    const verdicts = plan.verdicts ?? await Promise.all(plan.tried.slice(0, variants.length).map(async (alt, round) => {
      const { composed, local } = variants[round];
      const failed = (composed.pageErrors || []).find((message) => idOfMessage(message) === plan.id) ?? (composed.deck ? null : composed.error);
      const remaining = [...new Set(failed ? [`does not compose (${withoutId(String(failed).replace(/^Cannot render /, ""), plan.id).slice(0, 160)})`]
        : !gated.ran ? ["the page gates did not run"]
        : [...(gateFindings.get(`${round}|${plan.id}`) || []), ...local.filter((f) => String(f.id ?? "") === plan.id)].map(brief))];
      // An alternative that clears the gates is then asked whether it draws what the page wrote.
      const drops = !remaining.length && drawn ? await droppedFields(plan.page, alt.page, plan.index, drawn) : [];
      return { form: alt.form, commentary: alt.commentary, remaining, ...(drops.length ? { drops } : {}), ...(blocksOf.has(`${round}|${plan.id}`) ? { blocks: blocksOf.get(`${round}|${plan.id}`) } : {}) };
    }));
    // A page is remembered only when every alternative it was owed has a verdict.
    if (!plan.verdicts && verdicts.length === plan.tried.length && gated.ran) learned(plan, verdicts);
    const pass = [], partial = [], fail = [];
    for (const verdict of verdicts) {
      const alt = plan.tried.find((a) => a.form === verdict.form && a.commentary === verdict.commentary);
      const broken = alt ? structure(plan.id, alt.slide) : [];
      // What the swap would do to an aggregate read off the pages' text: an alternative that takes the deck out of its band is not one to propose.
      const shifts = aggregate && verdict.blocks && !verdict.remaining.length ? aggregate(plan.id, verdict.blocks) : [];
      if (!verdict.remaining.length && !broken.length && !shifts.length) (verdict.drops?.length ? partial : pass).push({ form: verdict.form, commentary: verdict.commentary, ...(verdict.drops?.length ? { drops: verdict.drops } : {}) });
      else fail.push({ form: verdict.form, commentary: verdict.commentary, remaining: verdict.remaining, ...(broken.length ? { structure: broken } : {}), ...(shifts.length ? { aggregate: shifts } : {}) });
    }
    const untried = [...plan.tried.slice(verdicts.length), ...plan.beyond].map(({ form, commentary }) => ({ form, commentary }));
    out.set(plan.id, { pass, partial, fail, needs: plan.needs, untried, capped: untried.length ? `${perPage} alternatives a page are composed (--fit-cap raises it)` : null });
  }
  return out;
}

const choiceName = ({ form, commentary }) => `form "${form}", commentary "${commentary}"`;

/** What the search found for a page, as the sentences its finding leads with and the lines printed under it. */
export function fitLines(fit) {
  if (!fit) return { lead: "", lines: [] };
  const lines = [
    // An alternative is called verified only on what verified it: the scene's checks without a render, the render's with one.
    ...fit.pass.map((alt) => `${alt.rendered ? "passes, rendered" : "passes the scene checks"}: ${choiceName(alt)} - compiles from the page as written, draws every field the page's own form uses, composes, clears the page gates and keeps the deck's structure rules` +
      (alt.rendered ? "; rendered with the build's stages, and the render's gates report nothing on it" : `; not rendered${alt.unrendered ? ` (${alt.unrendered})` : ""} - what only a render shows is checked by \`--check --render\``)),
    ...(fit.partial || []).map((alt) => `fits, dropping content: ${choiceName(alt)} - composes and clears the gates, and does not draw ${alt.drops.map((path) => (path.startsWith("(") ? path : `\`${path}\``)).join(", ")}: not the same content - take it only if the page can do without ${alt.drops.length === 1 ? "that" : "those"}`),
    ...fit.fail.map((alt) => `fails:  ${choiceName(alt)} - ${[...alt.remaining, ...(alt.structure || []).map((code) => `would break ${code} (deck structure)`), ...(alt.aggregate || [])].join("; ")}`),
    ...fit.needs.slice(0, 6).map((item) => `needs:  ${item.choices.slice(0, 4).map((c) => `${c.form}/${c.commentary}`).join(", ")}${item.choices.length > 4 ? ` and ${item.choices.length - 4} more` : ""} - ${item.needs}`),
    ...(fit.needs.length > 6 ? [`needs:  ${fit.needs.length - 6} more refusals, each a form or placement that needs other content`] : []),
    ...(fit.untried.length ? [`untried: ${fit.untried.map((c) => `${c.form}/${c.commentary}`).slice(0, 8).join(", ")}${fit.untried.length > 8 ? ` and ${fit.untried.length - 8} more` : ""} - ${fit.capped}`] : []),
  ];
  const rendered = fit.pass.length > 0 && fit.pass.every((alt) => alt.rendered);
  const lead = fit.pass.length
    ? `With the same content, ${fit.pass.map(choiceName).join(" or ")} ${rendered ? "fits (verified: composed, gated and rendered in this deck)" : "passes the scene checks (composed and gated in this deck; the render is checked by `--check --render`)"}. Choose one, or repair the page as it stands: `
    : fit.fail.length || (fit.partial || []).length ? `No other form or placement of this type fits with the same content (${fit.fail.length + (fit.partial || []).length} tried${fit.untried.length ? `, ${fit.untried.length} untried` : ""}${(fit.partial || []).length ? `; ${fit.partial.length} fit${fit.partial.length === 1 ? "s" : ""} only by dropping a field the page wrote` : ""}; listed below), so the page's content has to change: `
      : "";
  return { lead, lines };
}
