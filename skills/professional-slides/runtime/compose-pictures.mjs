// Pictures on a page: an image's props read from its file (`imageProps`,
// with its pixel size), the media references an exhibit makes, the players'
// logos, a photograph column, the `pictures` a picture page carries with their
// frames and cards, and the credits page that names every picture's source.
import fs from "node:fs";
import path from "node:path";
import { slugOf } from "./fetch-logos.mjs";
import { readJsonSync } from "./cli.mjs";

function imageDimensions(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), mime: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), mime: "image/jpeg" };
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error("Only PNG and JPEG images are supported");
}

/** Whether a picture reference names a file or carries its data: one planned as `{ alt, search }` waits for the build to fetch it. */
export const sourcedPicture = (ref) => typeof ref === "string" || Boolean(ref && typeof ref === "object" && (ref.path || ref.dataUri));

export function imageProps(ref, baseDir) {
  // A picture planned as `{ alt, search }` and not fetched yet composes as the frame carrying its alt line (pictureFrame);
  // the build fetches it (fetch-pictures.mjs). The cover and a divider, which draw only an embedded photograph, wait for it.
  if (!sourcedPicture(ref)) return { alt: ref?.alt };
  const file = path.resolve(baseDir, typeof ref === "string" ? ref : ref.path);
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // A named file that is not there is a mistake, never a placeholder: a typo
    // that quietly became a grey box is how a deck goes out with a hole in it.
    // A picture the author has not sourced yet is written without a `path` at
    // all, and composes as the frame with its alt text inside.
    throw new Error(`No picture at ${path.relative(baseDir, file) || file}. Pictures live beside the spec and are registered with their source and rights; a picture that has not been cleared yet is written as \`{ alt: "what it will show" }\` with no \`path\`, which composes as an empty frame carrying that line.`, { cause: error });
  }
  const { width, height, mime } = imageDimensions(buffer);
  return { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, width, height, alt: (typeof ref === "object" && ref.alt) || path.basename(file), ...(typeof ref === "object" && ref.credit ? { authorization: ref.credit } : {}) };
}


/** The declared players' logos that exist on disk, as embedded images, in the order the deck names them. */
export function playerMarks(spec, baseDir) {
  return (spec.players || []).map((p) => (typeof p === "string" ? { name: p } : p)).flatMap((player) => {
    if (!player?.name) return [];
    const own = player.logo && typeof player.logo === "object" && typeof player.logo.path === "string" ? player.logo.path : null;
    const found = own ?? ["png", "jpg"].map((ext) => path.join("assets", "logos", `${slugOf(player.name)}.${ext}`)).find((file) => fs.existsSync(path.resolve(baseDir, file)));
    if (!found) return [];
    // The credit the fetch recorded (assets/logos/sources.json), else the mark's own name.
    let credit = player.logo?.credit;
    if (!credit) credit = readJsonSync(path.resolve(baseDir, "assets", "logos", "sources.json"), { optional: true })?.find((r) => r.name === player.name)?.credit;
    try { return [{ ...imageProps({ path: found, alt: `${player.name} logo`, credit: credit ?? `${player.name} logo` }, baseDir), alt: `${player.name} logo` }]; } catch { return []; }
  });
}

// Keys under which a component expects embedded media rather than a file name.
const MEDIA_KEYS = new Set(["media", "photo", "image", "logo"]);

/**
 * Turn `{path, alt, credit}` references inside an exhibit into embedded media.
 *
 * A person's headshot, an icon-trends column's picture and a table's logo cell
 * all render from an embedded data URI, which an author writing a spec cannot
 * reasonably supply, so a media key that names a file is read from disk here.
 * A reference that already carries a data URI, or names no file, is left alone.
 */
export function resolveMediaRefs(value, baseDir, key = null) {
  if (Array.isArray(value)) return value.map((entry) => resolveMediaRefs(entry, baseDir, key));
  if (!value || typeof value !== "object") return value;
  if (key && MEDIA_KEYS.has(key) && typeof value.path === "string" && !value.dataUri) {
    const { path: _p, credit, ...rest } = value;
    return { ...rest, ...imageProps(value, baseDir), authorization: credit ?? value.authorization };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = resolveMediaRefs(v, baseDir, k);
  return out;
}

/** `photo: { path, alt, credit }` on a content page: a cropped photograph column. */
export function photoStrip(slide, id, baseDir, fr = 1) {
  if (!slide.photo) return null;
  return { id, component: "image-frame", props: { ...imageProps(slide.photo, baseDir), fit: "cover" }, size: { width: { fr }, height: "fill" } };
}

/**
 * `pictures`: the page's photographs, one per named thing.
 *
 * The plan's anchor rule says a page that enumerates named things depicts each
 * of them, and splits on what the thing is: an icon for a category or a
 * concept, a photograph for something depictable - a character, a city, a
 * product, a person. Icons are drawn by cards, rows lists and icon-led point
 * styles; these three shapes are where the photographs go.
 *
 * An entry is `{ path, alt, credit, label, text }`: the file, what it shows,
 * whose it is, the thing's name and the line about it. `label` and `text`
 * become the card under the picture, which is what makes a picture page an
 * argument rather than a mood board.
 *
 * A picture with no `path` is not an error. It composes as the frame with its
 * alt line inside it, so a page can be laid out, measured and gated before its
 * pictures are cleared - the gap is then visible on the page instead of
 * invisible in the plan. A `path` that does not resolve is an error (above).
 */
const PICTURES_MAX = 5;
export function normalizePictures(slide, id) {
  const list = slide.pictures;
  if (list === undefined) return [];
  if (!Array.isArray(list) || !list.length) throw new Error(`${id}: \`pictures\` is a list of one to ${PICTURES_MAX} photographs`);
  if (list.length > PICTURES_MAX) throw new Error(`${id}: ${list.length} pictures is a contact sheet, not a comparison; ${PICTURES_MAX} is the most one page can hold apart`);
  if (slide.exhibit || slide.exhibits) throw new Error(`${id}: the pictures are the evidence on a picture page; move the exhibit to a page of its own`);
  return list.map((entry, i) => {
    const picture = typeof entry === "string" ? { path: entry } : { ...entry };
    if (!picture.path && !picture.alt) throw new Error(`${id}: picture ${i + 1} names neither a file nor an \`alt\`; one of them has to say what the reader is looking at`);
    return picture;
  });
}

export function pictureFrame(picture, id, baseDir, size) {
  const props = picture.path
    ? { ...imageProps(picture, baseDir), fit: picture.fit || "cover" }
    : { alt: picture.alt };
  return { id, component: "image-frame", props, size };
}

/**
 * The cards under the pictures. Open cards, no edge: the photograph is already
 * the frame, and a hairline box around its label makes two frames around one
 * thing. They centre in whatever height is left, because a row of three-line
 * cards hugging the top of a 280px track with the rest empty is the page that
 * reads as unfinished.
 */
export function pictureCards(pictures, id, size) {
  const items = pictures.map((picture) => ({
    title: picture.label,
    ...(picture.text ? { text: picture.text } : {}),
    ...(picture.icon ? { icon: picture.icon } : {}),
    ...(picture.points ? { points: picture.points } : {}),
  }));
  return { id, component: "cards", props: { items, tone: "plain", valign: "middle" }, size };
}

/**
 * The generated last page crediting the photographs a licence requires the
 * deck to credit (CC BY, CC BY-SA: `credit` naming a licence other than CC0 or
 * the public domain). fetch-pictures.mjs writes those credits; a picture the
 * author cleared some other way carries its own `credit` and is listed the
 * same. None when no picture needs attribution.
 */
export function pictureCredits(spec) {
  const rows = [];
  const walk = (value, page) => {
    if (Array.isArray(value)) { value.forEach((v) => walk(v, page)); return; }
    if (!value || typeof value !== "object") return;
    if (typeof value.alt === "string" && (value.path || value.dataUri) && /\bCC[- ]BY\b/i.test(String(value.credit ?? ""))) {
      rows.push([page, value.alt, String(value.credit).replace(/^Photo:\s*/i, "")]);
    }
    for (const child of Object.values(value)) walk(child, page);
  };
  if (spec.cover) walk(spec.cover, "Cover");
  for (const slide of [...(spec.slides || []), ...(spec.appendix || [])]) walk(slide, slide.id ? `{{page:${slide.id}}}` : "");
  if (!rows.length) return [];
  return [{ id: "picture-credits", kind: "content", density: "appendix", title: "Picture credits",
    exhibit: { type: "table", columns: [{ label: "Page", type: "text", width: 60 }, { label: "Picture", type: "text" }, { label: "Author, licence and source", type: "text" }], rows } }];
}
