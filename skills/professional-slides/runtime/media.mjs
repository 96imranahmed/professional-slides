// Media primitives: a sample image read from assets/ on first use, a bitmap's
// dimensions, the media node every embedded picture is drawn as (fitted or
// cropped to its frame), and a logo's frame inside its slot. The media
// components are registry-media.mjs's.
import { readFileSync } from "node:fs";
import { primitive } from "./core.mjs";
import { readJsonSync } from "./cli.mjs";

// The component samples' images, read and encoded when a sample is first
// drawn: a deck that shows no sample never reads them.
const encoded = new Map();
const pngUri = (file) => {
  if (!encoded.has(file)) encoded.set(file, `data:image/png;base64,${readFileSync(new URL(`../assets/${file}`, import.meta.url)).toString("base64")}`);
  return encoded.get(file);
};
/** A sample image: `dataUri` read from assets/`file` on first use, then `fields`. */
export const sampleImage = (file, fields) => Object.assign({ get dataUri() { return pngUri(file); } }, fields);

/** The size and treatment of each Simple Icons mark (assets/simple-icons/treatments.json). */
export const WORDMARK_RECORDS = Object.freeze(readJsonSync(new URL("../assets/simple-icons/treatments.json", import.meta.url)));

export const MEDIA_SAMPLE = Object.freeze(sampleImage("lucide/briefcase-business.png", {
  alt: "Briefcase",
  authorization: "Lucide ISC license; assets/lucide/LICENSE",
  sourceUrl:
    "https://github.com/lucide-icons/lucide/blob/main/icons/briefcase-business.svg",
  width: 192,
  height: 192,
}));

export function bitmapDimensions(dataUri) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || "");
  if (!match) throw new Error("Media requires embedded PNG/JPEG");
  const bytes = Buffer.from(match[2], "base64");
  if (match[1] === "png") {
    if (bytes.length < 33 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Invalid PNG header");
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height) throw new Error("Invalid PNG dimensions");
    return { width, height };
  }
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) throw new Error("Invalid JPEG header");
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error("Invalid JPEG marker");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error("Truncated JPEG segment");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (length < 8) throw new Error("Invalid JPEG frame");
      const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) throw new Error("Invalid JPEG dimensions");
      return { width, height };
    }
    offset += length;
  }
  throw new Error("JPEG has no dimensions frame");
}

export function mediaNode({ id, frame, props, role = "image", fit = "contain" }) {
  if (
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(
      props?.dataUri || "",
    ) ||
    !props.alt?.trim() ||
    !props.authorization?.trim()
  )
    throw new Error(
      "Media requires embedded PNG/JPEG, alt text and authorization",
    );
  if (
    !(props.width > 0 && props.height > 0) ||
    !Number.isFinite(props.width + props.height)
  )
    throw new Error("Media requires positive intrinsic width and height");
  const intrinsic = bitmapDimensions(props.dataUri);
  if (props.width !== intrinsic.width || props.height !== intrinsic.height)
    throw new Error("Media intrinsic dimensions do not match the bitmap header");
  if (fit === "cover") {
    // Fill the frame and crop the overflow evenly from both sides (a photo
    // panel or full-bleed cover); the crop fractions travel with the node.
    const scale = Math.max(frame.width / props.width, frame.height / props.height);
    const w = props.width * scale, h = props.height * scale;
    const cropX = Math.max(0, (w - frame.width) / w / 2), cropY = Math.max(0, (h - frame.height) / h / 2);
    return primitive({ type: "image", id, role, frame: { ...frame }, data: { ...props, circular: false, fit: "cover", crop: { left: cropX, right: cropX, top: cropY, bottom: cropY } } });
  }
  const scale = Math.min(
    frame.width / props.width,
    frame.height / props.height,
  );
  const width = props.width * scale,
    height = props.height * scale;
  return primitive({
    type: "image",
    id,
    role,
    frame: {
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    },
    data: { ...props, circular: false },
  });
}

/**
 * A logo's frame inside its slot, sized to a common visual area rather than
 * fitted to the box. Fitted, a wide wordmark fills its 64px slot while a
 * square mark shrinks to the slot's height, a third of the ink; logo walls
 * equalise area instead. `area` is the ink each logo gets; the result keeps
 * the logo's aspect, stays inside the box, and sits against `align`.
 */
export function logoFrame(box, width, height, { area = box.width * box.height * 0.6, align = "center" } = {}) {
  const aspect = width > 0 && height > 0 ? width / height : box.width / box.height;
  let w = Math.sqrt(area * aspect), h = Math.sqrt(area / aspect);
  const shrink = Math.min(1, box.width / w, box.height / h);
  w *= shrink; h *= shrink;
  const x = align === "right" ? box.x + box.width - w : box.x + (box.width - w) / 2;
  return { x, y: box.y + (box.height - h) / 2, width: w, height: h };
}
