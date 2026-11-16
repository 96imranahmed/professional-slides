// The pages a photograph carries: two to five named things side by side with
// their cards (`picturesAcross`), and an exhibit on a card over the thing it
// measures (`photoBackdrop`). One subject beside its argument is a grid
// (compose-arrangements.mjs builtInGrid, `picture-hero`).
import { token } from "./core.mjs";
import { SIZE, HUG, BODY_WIDTH } from "./compose-body.mjs";
import { pictureFrame, pictureCards, pictureRows, imageProps } from "./compose-pictures.mjs";
import { pointsItem, sideTreatment } from "./compose-points.mjs";
import { exhibitItem } from "./compose-exhibits.mjs";
import { pointsUnderPanels } from "./compose-arrangements.mjs";

// Two named things side by side, or three to five across a strip, each with
// its card underneath. This is the page the reader can tell apart before
// reading a word of it, and the right shape for what would otherwise be a
// two-column table of sentences about two characters, two cities or two
// products.
export function picturesAcross(items, { id, slide, layout, pictures, baseDir, fill, pointsStyle }) {
  const described = pictures.some((p) => p.label || p.text);
  if (described && pictures.some((p) => !p.label)) {
    throw new Error(`${id}: every picture on a ${layout} needs a \`label\` once any of them carries one; the labels are the row of cards under the pictures`);
  }
  // The cards hug what they say and the pictures take everything left over.
  // The other way round - a fixed band with the cards spread under it - puts
  // a hundred pixels of nothing above the cards and another hundred below
  // them, and makes the row of cards the largest frame on a page whose
  // subject is the photographs.
  // Six to twelve run as a grid (compose-pictures.mjs pictureRows), each row of pictures over its own row of cards; a
  // short last row keeps the columns' widths, its open cells left empty, so every picture is the same size.
  const rows = pictureRows(pictures.length), across = Math.ceil(pictures.length / rows);
  for (let r = 0; r < rows; r += 1) {
    const row = pictures.slice(r * across, (r + 1) * across), at = r * across, tag = rows === 1 ? "" : `-${r + 1}`;
    const open = (k, size) => ({ id: `${id}-picture-open${tag}-${k}`, layout: "flow.column", size, items: [] });
    items.push({ id: `${id}-pictures${tag}`, layout: "flow.row", gap: "space.3", size: SIZE,
      items: [...row.map((picture, i) => pictureFrame(picture, `${id}-picture-${at + i}`, baseDir, { width: { fr: 1 }, height: "fill" })),
        ...Array.from({ length: across - row.length }, (_, k) => open(k, { width: { fr: 1 }, height: "fill" }))] });
    if (!described) continue;
    items.push(row.length === across ? pictureCards(row, `${id}-picture-cards${tag}`, HUG)
      : { id: `${id}-picture-cards-row${tag}`, layout: "flow.row", gap: "space.3", size: HUG,
        items: [pictureCards(row, `${id}-picture-cards${tag}`, { width: { fr: row.length }, height: "hug" }), open("cards", { width: { fr: across - row.length }, height: "hug" })] });
  }
  if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, pointsStyle));
}


// The exhibit on a card over a full-bleed photograph of what it measures:
// "numbers over the thing itself". The photo sets
// the subject; the card keeps the chart legible over it.
export function photoBackdrop(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle }) {
  if (!slide.photo) throw new Error(`${id}: a photo-backdrop page needs \`photo\`, the picture the card sits on`);
  if (slide.photo.crop !== undefined) throw new Error(`${id}: a backdrop runs to the slide's edges under its card, so it is not cropped to a circle; drop \`crop\`, or set the round photo on a picture-hero page`);
  if (exhibits.length !== 1) throw new Error(`${id}: a photo-backdrop page carries one exhibit on its card`);
  // The photograph runs to both edges of the slide under the card, so the
  // evidence reads as set on the place, not beside a picture of it.
  const backdrop = slide.photo.path
    ? { id: `${id}-backdrop`, component: "image-frame", props: { ...imageProps(slide.photo, baseDir), fit: "cover", bleed: "sides" }, size: SIZE }
    : { id: `${id}-backdrop`, component: "image-frame", props: { alt: slide.photo.alt, bleed: "sides" }, size: SIZE };
  const card = { id: `${id}-card`, treatment: "card", layout: "flow.column", gap: "space.3",
    size: { width: Math.round(BODY_WIDTH * 0.58), height: "fill" },
    // The card is a little over half the page wide, so points set across it
    // run 90-odd characters a line; they run in columns under the exhibit, as
    // they do under a row of panels, two to a row at most.
    items: [exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, SIZE),
            ...(slide.points?.length ? [pointsUnderPanels(slide.points, { id, slide, layout, panels: [], fill, pointsStyle, tone: "open", most: 2 })] : [])] };
  items.push({ id: `${id}-stage`, layout: "overlay", size: SIZE, items: [backdrop,
    // The photograph shows round the card on every side: a token, where the
    // bare name "space.5" read as no padding and set the card on the frame's edges.
    { id: `${id}-card-row`, layout: "flow.row", padding: token("space.5"), leftover: slide.photoSide === "right" ? "start" : "end", size: SIZE, items: [card] }] });
}
