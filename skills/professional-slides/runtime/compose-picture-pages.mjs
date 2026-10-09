// The pages a photograph carries: two to five named things side by side with
// their cards (`picturesAcross`), one subject beside its argument
// (`pictureHero`), and an exhibit on a card over the thing it measures
// (`photoBackdrop`).
import { SIZE, HUG, BODY_WIDTH } from "./compose-body.mjs";
import { pictureFrame, pictureCards, photoStrip, imageProps } from "./compose-pictures.mjs";
import { pointsItem, sideTreatment, proseOf } from "./compose-points.mjs";
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
  items.push({ id: `${id}-pictures`, layout: "flow.row", gap: "space.3", size: SIZE,
    items: pictures.map((picture, i) => pictureFrame(picture, `${id}-picture-${i}`, baseDir, { width: { fr: 1 }, height: "fill" })) });
  if (described) items.push(pictureCards(pictures, `${id}-picture-cards`, HUG));
  if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle));
}

// One subject, the argument beside it: the copy takes the left column (a
// toned panel when `pointsTone` says so), the picture the right, both full
// height. `photo` is another spelling of the same page and draws the same.
export function pictureHero(items, { id, slide, pictures, baseDir, fill, pointsStyle }) {
  const tone = sideTreatment(slide);
  const picture = pictures[0];
  const insightSpecs = (Array.isArray(slide.insights) ? slide.insights : slide.insight !== undefined ? [slide.insight] : []).filter((entry) => entry != null);
  const copy = [
    ...(slide.kpi ? [{ id: `${id}-kpi`, component: "metric", props: { ...slide.kpi, tone: "hero", variant: "prominent" }, size: { width: { fr: 1 }, height: 110 } }] : []),
    ...insightSpecs.map((insight, at) => ({ id: `${id}-insight-${at}`, component: "insight", props: { variant: insightSpecs.length > 1 && at === 0 ? "plain" : "tonal", ...(slide.highlight === undefined ? {} : { highlight: slide.highlight }), ...(typeof insight === "string" ? { text: insight } : insight) }, size: HUG })),
    ...proseOf(slide, id),
    ...(slide.points?.length ? [pointsItem(slide.points, `${id}-points`, tone, fill, true, pointsStyle)] : []),
  ];
  const column = { id: `${id}-side`, ...(slide.pointsHeading ? { heading: slide.pointsHeading } : {}), treatment: tone, layout: "flow.column", ...(slide.pointsAlign === "middle" ? { leftover: "center" } : {}), size: { width: { fr: 1.2 }, height: "fill" }, items: copy };
  // The picture's own line sits under it as a statement box, the way a
  // captioned panel does: naming the subject is the picture's job, not the
  // argument's.
  const frame = picture
    ? pictureFrame(picture, `${id}-picture`, baseDir, { width: { fr: 1 }, height: "fill" })
    : photoStrip(slide, `${id}-photo`, baseDir, 1);
  const caption = picture && (picture.label || picture.text)
    ? { id: `${id}-picture-caption`, component: "insight", props: { text: [picture.label, picture.text].filter(Boolean).join(" — "), variant: "neutral", align: "center" }, size: HUG }
    : null;
  const side = caption
    ? { id: `${id}-picture-column`, layout: "flow.column", gap: "space.3", size: { width: { fr: 1 }, height: "fill" }, items: [{ ...frame, size: { width: { fr: 1 }, height: "fill" } }, caption] }
    : frame;
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [column, side] });
}

// The exhibit on a card over a full-bleed photograph of what it measures:
// "numbers over the thing itself". The photo sets
// the subject; the card keeps the chart legible over it.
export function photoBackdrop(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle }) {
  if (!slide.photo) throw new Error(`${id}: a photo-backdrop page needs \`photo\`, the picture the card sits on`);
  if (exhibits.length !== 1) throw new Error(`${id}: a photo-backdrop page carries one exhibit on its card`);
  const backdrop = slide.photo.path
    ? { id: `${id}-backdrop`, component: "image-frame", props: { ...imageProps(slide.photo, baseDir), fit: "cover" }, size: SIZE }
    : { id: `${id}-backdrop`, component: "image-frame", props: { alt: slide.photo.alt }, size: SIZE };
  const card = { id: `${id}-card`, treatment: "card", layout: "flow.column", gap: "space.3",
    size: { width: Math.round(BODY_WIDTH * 0.58), height: "fill" },
    // The card is a little over half the page wide, so points set across it
    // run 90-odd characters a line; they run in columns under the exhibit, as
    // they do under a row of panels, two to a row at most.
    items: [exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, SIZE),
            ...(slide.points?.length ? [pointsUnderPanels(slide.points, { id, slide, layout, panels: [], fill, pointsStyle, tone: "open", most: 2 })] : [])] };
  items.push({ id: `${id}-stage`, layout: "overlay", size: SIZE, items: [backdrop,
    { id: `${id}-card-row`, layout: "flow.row", padding: "space.5", leftover: slide.photoSide === "right" ? "start" : "end", size: SIZE, items: [card] }] });
}
