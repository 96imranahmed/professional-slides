// The pages file's `sources` registry checked on its own: what a source is
// (its name, short form, URL and status, each held to the length of what it
// is; when it was read, `retrieved`, which no citation prints) and what it may
// be declared not to name. The compile refuses a registry
// with a problem (author-deck.mjs compileDeck); the research step reads the
// same check (analysis.mjs), so a source written as a caveat is caught by the
// worker who wrote it, not at the first draft of the spine.
import { SOURCE_TITLE_WORDS } from "./page-template.mjs";
import { textWords } from "./text-contract.mjs";

// What a source can be declared not to name, and the length of the reason: a sentence, long enough to say something.
const SOURCE_MISSING = Object.freeze(["publisher", "date", "document"]);
const MISSING_REASON = Object.freeze({ min: 5, max: 40 });

/** Every problem with the pages file's `sources` registry, as sentences. */
export function registryProblems(sources) {
  if (sources === undefined) return [];
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return ["`sources` is a registry - { key: { name, url, status } }"];
  return Object.entries(sources).flatMap(([key, entry]) => {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) return [`source "${key}" needs its \`name\` - the publisher and title as the citation prints them`];
    const extra = Object.keys(entry).filter((k) => !["name", "short", "url", "status", "retrieved", "missing", "reason"].includes(k));
    // A record that names no publisher, no date or no document says so once, here, with the reason: the deck then states the
    // limit once (compose-deck.mjs sourceLimitPages) and each page that cites the record carries it for the reviewers, rather
    // than every such page being found wanting on its own. It is not a way to leave a source unnamed: `name` still says what it is.
    const listed = Array.isArray(entry.missing) && entry.missing.length > 0 && entry.missing.every((item) => SOURCE_MISSING.includes(item)) && new Set(entry.missing).size === entry.missing.length;
    const reasoned = typeof entry.reason === "string" && textWords(entry.reason) >= MISSING_REASON.min && textWords(entry.reason) <= MISSING_REASON.max;
    const provenance = [
      ...(entry.missing !== undefined && !listed ? [`source "${key}": \`missing\` lists what the record does not name - one or more of ${SOURCE_MISSING.map((item) => `"${item}"`).join(", ")}, each once - or is left out for a source that names all three`] : []),
      ...(listed && !reasoned ? [`source "${key}" declares it names no ${entry.missing.join(", no ")}: say why in \`reason\` - who supplied the record and what is known of it - in ${MISSING_REASON.min} to ${MISSING_REASON.max} words; the deck states it once, on the page it derives for the sources' limits`] : []),
      ...(entry.missing === undefined && entry.reason !== undefined ? [`source "${key}": \`reason\` says why the record names no publisher, date or document, and goes with \`missing\`; a source that names all three needs none`] : []),
      ...(listed && entry.missing.includes("publisher") && typeof entry.url === "string" && entry.url.trim() ? [`source "${key}" declares it names no publisher and gives a \`url\`: a record with a URL has a publisher - name it in \`name\` and take "publisher" out of \`missing\``] : [])];
    // A name is a title and a status a label: each is held to the length of what it is, so a registry entry cannot carry a page's caveats.
    const kind = { name: "its title - the publisher, the publication and its year -", short: "its title in brief", status: "the kind of record it is (\"audited\", \"company-reported\") -" };
    const wordy = Object.entries(SOURCE_TITLE_WORDS).filter(([k, max]) => typeof entry[k] === "string" && textWords(entry[k]) > max)
      .map(([k, max]) => `source "${key}": \`${k}\` runs to ${textWords(entry[k])} words, and a source's \`${k}\` is ${kind[k]} in ${max} words or fewer. A caveat, a scope or a method is a note, not a source: write it in the page's \`note\`, where it is counted (NOTE_HEAVY) and fitted to the footer`);
    return [...(extra.length ? [`source "${key}": unknown key${extra.length === 1 ? "" : "s"} ${extra.join(", ")} - a source is { name, short, url, status, retrieved }, with { missing: ["publisher" | "date" | "document"], reason } where the record does not name one`] : []),
      ...["short", "url", "status", "retrieved"].filter((k) => entry[k] !== undefined && typeof entry[k] !== "string").map((k) => `source "${key}": \`${k}\` is text`), ...wordy, ...provenance];
  });
}

