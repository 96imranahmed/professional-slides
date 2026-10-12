// Pictures on a page: an image's props read from its file (`imageProps`,
// with its pixel size), the media references an exhibit makes, the players'
// marks (a logo, a place's outline, a photograph), a photograph column, the
// `pictures` a picture page carries with their frames and cards, the kinds a
// picture is (a photograph or a drawn illustration), and the credits page that
// names every picture's source.
import fs from "node:fs";
import path from "node:path";
import { slugOf } from "./fetch-logos.mjs";
import { readJsonSync } from "./cli.mjs";
import { placeOutline } from "./maps.mjs";
import { playerEntries, plannedMark } from "./players.mjs";

/**
 * What a planned picture is, by its `kind`: a photograph, the default, or a
 * drawn illustration - a line or flat-colour drawing beside the copy, as nine
 * sampled consulting pages set one. Each kind is searched, looked at, saved
 * and fitted as its own (fetch-pictures.mjs): an illustration is fetched from
 * Commons' drawings and drawn whole in its frame, where a photograph is
 * cropped to fill it.
 */
export const PICTURE_KINDS = Object.freeze({
  photograph: "a photograph, searched among Commons' photographs and cropped to fill its frame (the default)",
  illustration: "a drawn illustration, searched among Commons' drawings and drawn whole in its frame",
});
/** Whether a picture is planned as a drawn illustration. */
export const isIllustration = (picture) => Boolean(picture && typeof picture === "object" && picture.kind === "illustration");
// How a picture fills its frame when the page does not say: a photograph is cropped to it, an illustration is drawn whole.
const fitOf = (picture) => picture.fit || (isIllustration(picture) ? "contain" : "cover");

const PICTURE_KEYS = new Set(["photo", "image", "media", "logo"]);
/**
 * Every `kind` a compiled page writes on a picture, held to the kinds there
 * are, or the page is refused: an unknown kind would be searched as a
 * photograph without a word, and an illustration in a mark's place - a chart
 * category's, a logo cell's, a column's - would never be fetched, since a
 * mark is a logo's or a flag's.
 */
export function planPictureKinds(slide, id) {
  const kinds = Object.entries(PICTURE_KINDS).map(([kind, about]) => `"${kind}" (${about})`).join(" or ");
  const visit = (value, key, mark) => {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, key === "pictures" ? "photo" : null, mark)); return; }
    if (!value || typeof value !== "object") return;
    if (PICTURE_KEYS.has(key) && value.kind !== undefined) {
      if (!Object.hasOwn(PICTURE_KINDS, value.kind)) throw new Error(`${id}: the picture under \`${key}\` says kind ${JSON.stringify(value.kind)}; a picture's \`kind\` is ${kinds}`);
      if (mark && isIllustration(value)) throw new Error(`${id}: an illustration is a picture beside the copy - a page's \`photo\` or a picture page's \`pictures\` - and \`${key}\` here is a mark beside a label; give the mark a logo, a flag or an icon`);
    }
    const marks = mark || key === "categoryIcons" || key === "logo" || value.type === "logo" || value.type === "logos";
    for (const [child, next] of Object.entries(value)) visit(next, child, marks);
  };
  for (const [key, value] of Object.entries(slide)) visit(value, key, false);
  return slide;
}

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


/**
 * A place's outline planned as a mark (`{ alt, outline: { geography, region } }`,
 * players.mjs plannedMark), read from the geography data the maps draw
 * (maps.mjs placeOutline): its paths and the aspect its slot reads, with the
 * data's source as the mark's credit. No file and no network.
 */
export function outlineProps(ref) {
  const { outline, ...rest } = ref;
  const drawn = placeOutline(outline);
  return { ...rest, outline: { paths: drawn.paths, geography: drawn.geography, regions: drawn.regions }, width: drawn.width, height: drawn.height, authorization: drawn.source };
}

/**
 * The declared players' marks that can be drawn, in the order the deck names
 * them, each in the kind it declares (players.mjs): a logo on disk (the
 * player's own `logo`, or assets/logos/ as the build fetches it) as an
 * embedded image; a place's outline, read from the geography data; a thing's
 * photograph on disk (its own `path`, or assets/pictures/ as the picture fetch
 * names it), as an embedded image.
 */
export function playerMarks(spec, baseDir) {
  return playerEntries(spec.players).flatMap((player) => {
    if (player.kind === "outline") { try { return [outlineProps(plannedMark(player))]; } catch { return []; } }
    if (player.kind === "image") {
      const own = typeof player.image?.path === "string" ? player.image.path : null, alt = String(player.image?.alt ?? "").trim();
      const file = own ?? (alt ? path.join("assets", "pictures", `${slugOf(alt)}.jpg`) : null);
      if (!file || !fs.existsSync(path.resolve(baseDir, file))) return [];
      const credit = player.image.credit ?? readJsonSync(path.resolve(baseDir, "assets", "pictures", "sources.json"), { optional: true })?.find((r) => r.alt === player.image.alt)?.credit;
      try { return [{ ...imageProps({ path: file, alt, credit: credit ?? `Photo: ${alt}` }, baseDir), mark: "image", player: player.name }]; } catch { return []; }
    }
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
 * A place's mark, planned as its `outline`, is read from the geography data
 * (outlineProps). A reference that already carries a data URI, or names no
 * file, is left alone.
 */
export function resolveMediaRefs(value, baseDir, key = null) {
  if (Array.isArray(value)) return value.map((entry) => resolveMediaRefs(entry, baseDir, key));
  if (!value || typeof value !== "object") return value;
  // A place's mark is its outline, read from the geography data rather than a file.
  if (key && MEDIA_KEYS.has(key) && value.outline && typeof value.outline === "object" && !Array.isArray(value.outline.paths)) return outlineProps(value);
  if (key && MEDIA_KEYS.has(key) && typeof value.path === "string" && !value.dataUri) {
    const { path: _p, credit, ...rest } = value;
    return { ...rest, ...imageProps(value, baseDir), authorization: credit ?? value.authorization };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = resolveMediaRefs(v, baseDir, k);
  return out;
}

/** `photo: { path, alt, credit, crop? }` on a content page: a cropped photograph column, an illustration drawn whole in it, or a round photo. */
export function photoStrip(slide, id, baseDir, fr = 1) {
  if (!slide.photo) return null;
  checkPictures([slide.photo], id);
  return { id, component: "image-frame", props: { ...imageProps(slide.photo, baseDir), fit: isIllustration(slide.photo) ? "contain" : "cover", ...(slide.photo.crop ? { crop: slide.photo.crop } : {}) }, size: { width: { fr }, height: "fill" } };
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
// A strip runs one row of up to five pictures. Six to twelve - the sites, the fleet, the people a page sets out - run as
// a grid of two or three rows, where twelve across would shrink each to a stamp; past twelve the page is a contact sheet.
export const PICTURES = Object.freeze({ across: 5, most: 12 });
/**
 * The rows a strip of `count` pictures takes: one up to five across, then two
 * or three, five across at most - the count that leaves the fewest cells
 * empty, two where they tie (six is two rows of three, nine three of three,
 * eleven three of four with one cell open).
 */
export function pictureRows(count) {
  if (count <= PICTURES.across) return 1;
  const open = (rows) => rows * Math.ceil(count / rows) - count;
  return [2, 3].filter((rows) => Math.ceil(count / rows) <= PICTURES.across).sort((a, b) => open(a) - open(b) || a - b)[0];
}

/**
 * What a page's pictures may be: one to twelve, more than five only on a
 * strip (the grid); each `crop` "circle" or none, and one crop for them all -
 * a row of round portraits with one square photo among them reads as a
 * mistake, not a choice.
 */
export function checkPictures(list, id, form = null) {
  if (list.length > PICTURES.most) throw new Error(`${id}: ${list.length} pictures is a contact sheet, not a comparison; ${PICTURES.most} is the most one page can hold apart, in three rows`);
  if (list.length > PICTURES.across && form && form !== "picture-strip")
    throw new Error(`${id}: ${list.length} pictures run as a grid of two or three rows, which a picture-strip page sets; a ${form} page holds ${form === "picture-hero" ? "one" : form === "picture-pair" ? "two" : `up to ${PICTURES.across}`}`);
  const crops = list.map((entry) => (entry && typeof entry === "object" ? entry.crop : undefined));
  const odd = crops.find((crop) => crop !== undefined && crop !== "circle");
  if (odd !== undefined) throw new Error(`${id}: a picture's \`crop\` is "circle" (a round photo) or left out (got ${JSON.stringify(odd)})`);
  if (new Set(crops).size > 1) throw new Error(`${id}: ${crops.filter(Boolean).length} of ${list.length} pictures are cropped to a circle; a page's pictures take one crop - every one \`crop: "circle"\`, or none`);
}

export function normalizePictures(slide, id) {
  const list = slide.pictures;
  if (list === undefined) return [];
  if (!Array.isArray(list) || !list.length) throw new Error(`${id}: \`pictures\` is a list of one to ${PICTURES.most} photographs`);
  checkPictures(list, id, typeof slide.layout === "string" && slide.layout.startsWith("picture-") ? slide.layout : null);
  if (slide.exhibit || slide.exhibits) throw new Error(`${id}: the pictures are the evidence on a picture page; move the exhibit to a page of its own`);
  return list.map((entry, i) => {
    const picture = typeof entry === "string" ? { path: entry } : { ...entry };
    if (!picture.path && !picture.alt) throw new Error(`${id}: picture ${i + 1} names neither a file nor an \`alt\`; one of them has to say what the reader is looking at`);
    return picture;
  });
}

export function pictureFrame(picture, id, baseDir, size) {
  const props = picture.path
    ? { ...imageProps(picture, baseDir), fit: fitOf(picture) }
    : { alt: picture.alt };
  return { id, component: "image-frame", props: { ...props, ...(picture.crop ? { crop: picture.crop } : {}) }, size };
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
      rows.push([page, value.alt, String(value.credit).replace(/^(?:Photo|Illustration|Flag):\s*/i, "")]);
    }
    for (const child of Object.values(value)) walk(child, page);
  };
  if (spec.cover) walk(spec.cover, "Cover");
  for (const slide of [...(spec.slides || []), ...(spec.appendix || [])]) walk(slide, slide.id ? `{{page:${slide.id}}}` : "");
  if (!rows.length) return [];
  return [{ id: "picture-credits", kind: "content", density: "appendix", title: "Picture credits",
    exhibit: { type: "table", columns: [{ label: "Page", type: "text", width: 60 }, { label: "Picture", type: "text" }, { label: "Author, licence and source", type: "text" }], rows } }];
}
