// What a deck needs from the network, decided where the deck is written.
//
// A deck that declares `players` shows their marks - a logo for an
// organisation, a photograph for a thing with a look, and an outline for a
// place, which the runtime draws from its own geography and never fetches
// (players.mjs) - a planned photograph is written as `{ alt }`, and a map
// marker may name a `place`: the build fetches each logo, photograph and place
// (fetch-logos.mjs, fetch-pictures.mjs, fetch-places.mjs). Nothing said
// so before the build, and a run with no network learnt it last - a deck with
// declared players and no logo files was refused after its render, and could
// never be delivered offline. The need is stated at the first compile, draft
// included, with the three ways to meet it:
//
//   (a) supply the files, under the names the build looks for;
//   (b) let the build fetch them - the default, and what happens online;
//   (c) declare on the deck that it is built without the network:
//
//       "assets": { "fetch": "none", "reason": "The build machine has no network access and the client supplied no logo files" }
//
// Under (c) the build fetches nothing, the players are introduced by name
// where their marks would be, the missing logos do not block the build, and
// the build result, the reviewer's packet and the delivery report all say
// which files were not available and why. Photographs are covered the same
// way: with none supplied in assets/pictures/ the deck is expected to carry
// no picture page (gates/craft_gates.mjs advises CRAFT_NO_PICTURES instead of
// holding it), and the build result and the reviewers are told so - `noPictures`
// stays what it was, the sentence of a deck whose subject has nothing to look
// at. A photograph a page still plans as `{ alt }` is an empty frame, and
// delivery refuses it (BAR_UNSOURCED_PICTURES) whatever the deck declares. Nothing verifies the reason: the
// runtime checks that it is a sentence and cannot tell whether the machine
// had a network. So it is a statement the reviewer is shown, not a waiver of
// the reviewer's judgement: a page that fails without its marks is still a
// finding, and a player still has to be named in a page's content (not in a
// source line or a note) to count as introduced (gates/craft_gates.mjs).
import fs from "node:fs/promises";
import path from "node:path";
import { readJson } from "./cli.mjs";
import { registered } from "./errors.mjs";
import { slugOf } from "./fetch-logos.mjs";
import { picturePlaceholders } from "./fetch-pictures.mjs";
import { markersToPlace } from "./fetch-places.mjs";
import { textWords } from "./text-contract.mjs";
import { logoPlayers } from "./players.mjs";

export const ASSET_CODES = Object.freeze({
  ASSETS_NEEDED: "the deck plans logos, photographs or places whose files are not in its assets folder; the build will fetch them unless they are supplied or the deck declares it is built without the network",
  ASSETS_OFFLINE: "the deck declares it is built without the network (`assets.fetch` is none): what it could not fetch is named, and the reviews are told",
});

const FETCH = Object.freeze({
  build: "the build fetches what is missing (the default)",
  none: "nothing is fetched: the deck is built without the network, and says why in `reason`",
});
const REASON_WORDS = 6;

/** The deck's declaration, read: `{ fetch: "none", reason }` when it is built without the network, else `{ fetch: "build" }`. */
export const assetsDeclaration = (deck) => (deck?.assets?.fetch === "none" ? { fetch: "none", reason: String(deck.assets.reason ?? "").trim() } : { fetch: "build" });

/** Why a deck's `assets` is not in the form the build and the reviews read, as sentences; none when it is absent or well formed. */
export function assetsDeclarationErrors(deck) {
  const assets = deck?.assets;
  if (assets === undefined) return [];
  const form = `\`assets\` is { fetch, reason }: \`fetch\` one of ${Object.entries(FETCH).map(([key, about]) => `"${key}" (${about})`).join("; ")}`;
  if (!assets || typeof assets !== "object" || Array.isArray(assets) || !Object.hasOwn(FETCH, assets.fetch)) return [form];
  const extra = Object.keys(assets).filter((key) => !["fetch", "reason"].includes(key));
  return [...(extra.length ? [`\`assets\` takes fetch and reason only (got ${extra.join(", ")})`] : []),
    ...(assets.fetch === "none" && textWords(assets.reason) < REASON_WORDS ? [`\`assets.fetch: "none"\` says in \`reason\` why the deck is built without the network, in a sentence: the reviewer is shown it`] : [])];
}

const exists = (file) => fs.access(file).then(() => true, () => false);

/** How many photographs are supplied beside the deck: the image files in its assets/pictures/ folder. */
export async function suppliedPictures(baseDir) {
  const names = await fs.readdir(path.resolve(baseDir, "assets", "pictures")).catch(() => []);
  return names.filter((name) => /\.(?:jpe?g|png)$/i.test(name)).length;
}
// What a deck built without the network says of its photographs, to the author, in the build result and to the reviewers.
const photographsLine = (supplied) => (supplied ? `${plural(supplied, "photograph")} supplied in assets/pictures/; none is fetched`
  : "no photograph is supplied in assets/pictures/ and none is fetched, so the deck is expected to carry no picture page");

/**
 * What the build would have to fetch for this deck, with the file each would
 * be read from were it supplied instead (paths relative to the deck's folder):
 * `logos` for the declared players marked by a logo without one, `pictures`
 * for the planned photographs - a player marked by its photograph among them,
 * by its `image` - and `places` for the map markers that name a place and
 * carry no coordinates. A player marked by its outline needs nothing: it is
 * drawn from the runtime's geography (players.mjs). A file already in the
 * assets folder is not a need.
 */
export async function assetNeeds(spec, baseDir) {
  const players = logoPlayers(spec.players);
  const logos = [];
  for (const player of players) {
    const files = ["png", "jpg"].map((ext) => path.join("assets", "logos", `${slugOf(player.name)}.${ext}`));
    if (!(await Promise.all(files.map((file) => exists(path.resolve(baseDir, file))))).some(Boolean)) logos.push({ name: player.name, file: files[0] });
  }
  const pictures = [];
  for (const alt of [...new Set(picturePlaceholders(spec).map((picture) => picture.alt.trim()))]) {
    const file = path.join("assets", "pictures", `${slugOf(alt)}.jpg`);
    if (!(await exists(path.resolve(baseDir, file)))) pictures.push({ alt, file });
  }
  const known = (await readJson(path.resolve(baseDir, "assets", "places.json"), { optional: true })) ?? {};
  const places = [...new Set(markersToPlace(spec).map(({ name }) => name))].filter((name) => !known[name]);
  return { logos, pictures, places };
}

const count = (needs) => needs.logos.length + needs.pictures.length + needs.places.length;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The three ways to meet the need, as the author reads them at the compile.
function choices(needs) {
  const supply = [
    ...(needs.logos.length ? [`each logo as a PNG or JPEG at ${needs.logos.map((logo) => logo.file).join(", ")} (.jpg is read too)`] : []),
    ...(needs.pictures.length ? [`each photograph as a JPEG at ${needs.pictures.map((picture) => picture.file).join(", ")}, or with its own \`path\` and \`credit\` on the page`] : []),
    ...(needs.places.length ? [`\`longitude\` and \`latitude\` on each marker (${needs.places.join(", ")}), or the names in assets/places.json as { "<name>": { "longitude", "latitude" } }`] : []),
  ];
  return [
    `(a) supply the files beside the pages file: ${supply.join("; ")}`,
    "(b) let the build fetch them: the default, and it needs the network when `build-deck.mjs` runs",
    `(c) declare the deck is built without the network, on \`deck\`: "assets": { "fetch": "none", "reason": "<a sentence saying why>" } - nothing is fetched, the players are introduced by name where their logos would be, a deck supplied no photograph is expected to carry no picture page (that is not what \`noPictures\` is for), and the build result, the reviewer's packet and the delivery report say which files were not available${needs.pictures.length ? "; a planned photograph stays an empty frame, which delivery refuses (`BAR_UNSOURCED_PICTURES`) until its file is supplied or the picture is taken off the page" : ""}${needs.places.length ? "; a marker that names a place still needs its `longitude` and `latitude` written on it" : ""}`,
  ];
}

/**
 * What the compile says about the deck's network needs: `statement` - the
 * declaration, what is needed and the choices, for the compile's summary -
 * and the advisory `findings` that carry it (ASSETS_NEEDED while the build is
 * to fetch, ASSETS_OFFLINE under an offline declaration). Both are empty when
 * the deck needs nothing and declares nothing. A malformed declaration is
 * refused with the deck's other statements (review-passes.mjs deckStatementFindings).
 */
export async function assetFindings(spec, baseDir) {
  const declared = assetsDeclaration(spec);
  const needs = await assetNeeds(spec, baseDir);
  if (!count(needs) && declared.fetch !== "none") return { statement: null, findings: [] };
  const needed = { logos: needs.logos.map((logo) => logo.name), pictures: needs.pictures.map((picture) => picture.alt), places: needs.places };
  const what = [needs.logos.length ? `${plural(needs.logos.length, "logo")} (${needed.logos.join(", ")})` : "", needs.pictures.length ? plural(needs.pictures.length, "photograph") : "", needs.places.length ? plural(needs.places.length, "place") : ""].filter(Boolean).join(", ");
  if (declared.fetch === "none") {
    const supplied = await suppliedPictures(baseDir);
    const repair = `${count(needs)
      ? `The deck declares it is built without the network ("${declared.reason}"), so the build fetches nothing: ${what} will not be available. The players are introduced by name, and the build result, the reviewer's packet and the delivery report say so. To show them instead, ${choices(needs)[0].slice(4)}`
      : `The deck declares it is built without the network ("${declared.reason}"); every file it plans is already in its assets folder, so nothing is missing`}. Photographs: ${photographsLine(supplied)}${needs.pictures.length ? `; the ${plural(needs.pictures.length, "photograph")} the pages still plan as \`{ alt }\` stay empty frames, which delivery refuses (\`BAR_UNSOURCED_PICTURES\`) - supply each file or take the picture off its page` : ""}`;
    return { statement: { fetch: "none", reason: declared.reason, notAvailable: needed, photographs: { supplied, expected: supplied > 0 || needs.pictures.length > 0 }, ...(count(needs) ? { supply: choices(needs)[0] } : {}) },
      findings: [{ code: registered(ASSET_CODES, "ASSETS_OFFLINE"), severity: "advisory", measured: needed, repair }] };
  }
  const options = choices(needs);
  return { statement: { fetch: "build", needsNetwork: needed, choices: options },
    findings: [{ code: registered(ASSET_CODES, "ASSETS_NEEDED"), severity: "advisory", measured: needed,
      repair: `The build will fetch ${what} from the network: none of these files is in the deck's assets folder. Decide now, not at the build: ${options.join("; ")}` }] };
}

/** The statement as the compile prints it, on every run that has one - a refused run included - so the need is read before the build. */
export function assetNotice(statement) {
  if (!statement) return null;
  const list = (needed) => [needed.logos.length ? `logos: ${needed.logos.join(", ")}` : "", needed.pictures.length ? `photographs: ${needed.pictures.join("; ")}` : "", needed.places.length ? `places: ${needed.places.join(", ")}` : ""].filter(Boolean).join(" | ");
  if (statement.fetch === "none") return `Assets: the deck is built without the network ("${statement.reason}").${list(statement.notAvailable) ? ` Not available, and said so to the reviewer - ${list(statement.notAvailable)}.\n  ${statement.supply}` : " Every planned file is already in the assets folder."}` +
    `\n  Photographs: ${photographsLine(statement.photographs?.supplied ?? 0)}${statement.photographs?.supplied ? "" : " (no `noPictures` is needed: that is for a subject with nothing to look at); the reviewers are told"}.`;
  return `Assets: the build will fetch from the network - ${list(statement.needsNetwork)}. Decide now:\n${statement.choices.map((choice) => `  ${choice}`).join("\n")}`;
}

/**
 * What a build records about its assets (`assets` in build-result.json), or
 * null when it has nothing to say: the deck's declaration, whether the build
 * fetched, and what is still not available after it; under an offline
 * declaration, how many photographs were supplied (`photographs.supplied`) -
 * none means the deck was expected to carry no picture page. `fetched` is false for a
 * build run with `--no-fetch`.
 */
export async function assetReport(spec, baseDir, { fetched = true } = {}) {
  const declared = assetsDeclaration(spec);
  const needs = await assetNeeds(spec, baseDir);
  if (!count(needs) && declared.fetch !== "none") return null;
  return { fetch: declared.fetch === "none" ? "none" : fetched ? "build" : "skipped", ...(declared.fetch === "none" ? { reason: declared.reason, photographs: { supplied: await suppliedPictures(baseDir) } } : {}),
    notAvailable: { logos: needs.logos.map((logo) => logo.name), pictures: needs.pictures.map((picture) => picture.alt), places: needs.places } };
}

/** What a reviewer is told about a build's assets (the build's `assets` record), as a paragraph of its prompt; "" when there is nothing to say. */
export function assetsPrompt(assets) {
  const missing = assets?.notAvailable;
  // A deck built without the network and supplied no photograph carries none: said to the reviewer whether or not anything else is missing.
  const unpictured = assets?.fetch === "none" && assets.photographs?.supplied === 0;
  const any = Boolean(missing) && missing.logos.length + missing.pictures.length + missing.places.length > 0;
  if (!assets || !missing || !(any || unpictured)) return "";
  const what = [missing.logos.length ? `the logos of ${missing.logos.join(", ")}` : "", missing.pictures.length ? `${plural(missing.pictures.length, "planned photograph")}` : "", missing.places.length ? `the map positions of ${missing.places.join(", ")}` : ""].filter(Boolean).join("; ");
  const pictures = unpictured ? " No photograph was supplied to it and none was fetched, so the deck was expected to carry no picture page: do not file a finding only because the deck has no photograph." : "";
  return assets.fetch === "none"
    ? `ASSETS NOT AVAILABLE. The deck declares it was built without network access - its reason: "${assets.reason}".${any ? ` Not available to it: ${what}. The players are introduced by name where their marks would be.` : ""}${pictures} This is the author's declaration, shown to you, not a ruling: do not file a finding only because a logo is absent, and do file one where a page does not work without its marks or pictures.`
    : `ASSETS NOT AVAILABLE. The build could not obtain ${what}, and the deck does not declare that it was built without the network: judge the pages as they are.`;
}
