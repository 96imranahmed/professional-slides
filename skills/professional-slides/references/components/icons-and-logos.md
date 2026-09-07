# Icons, Category Images, and Logos

Icons and logos identify real entities, categories, capabilities, steps, or repeated states. Images may add recognition, context, or evidence when they communicate more than an abstract mark. Use visuals to reduce repeated copy or improve scanning, never to add density. Use assets admitted by the [asset authorization record](#asset-authorization-record) and one registered icon library per deck. Without a registered library, default to Lucide. Use another coherent library only when it supplies a clearer named icon for a registered semantic slot that Lucide cannot represent at slide scale, or when the asset record requires that visual system.

## Asset authorization record

Before reuse, register each external image, logo, icon library, visual system, or source deck in `assetAuthorizationRecord` in the [pre-authoring deck contract](../storylining/pre-authoring-contract.md). For a bounded revision without that contract, use the same field in the revision's acceptance manifest. Record its source URL or repository path, rights or user-approval reference, permitted use, required attribution, canonical stored asset path, and fallback when reuse is not permitted. The user message, brand guideline, licence, or asset-owner approval that establishes permission is the authoritative evidence. Missing evidence means use a labelled placeholder, text fallback, or no asset; do not infer permission. Later references to an `approved` or `authorized` visual mean an entry in this record.

## Select and register the icon system

Before authoring, identify the semantic slots that may benefit from icons: category fields, concise section headings, capability or step markers, row labels, and repeated table-cell states. Admit an icon only after naming its semantic slot and either the repeated label it replaces or the recognition task it accelerates, then verify that peers remain distinct at the final rendered size. Otherwise omit it. Do not add icons merely to occupy whitespace, decorate every heading, or make a weak composition look finished.

Record each selected icon's meaning, library, exact icon name, size, stroke or fill treatment, colour role, and label behavior in the deck's semantic treatment registry. Reuse the same icon for the same meaning across the deck and do not reuse it for a different meaning. Use an icon with text until the mapping is obvious; use an icon alone only when a column heading, nearby legend, or repeated convention makes the meaning unambiguous.

For Lucide, use the actual vector definition from the available Lucide package or official SVG source and preserve its `24 x 24` viewBox, rounded joins and caps, and outline grammar. Do not redraw a Lucide-like approximation, substitute emoji or icon-font glyphs, or invent a generic circle or square when a named semantic icon is intended. Do not force a weak Lucide metaphor: if no icon reads clearly at slide scale, retain the text or use another approved coherent library.

## Entity logos

Use logos in market maps, bubble charts, ecosystem diagrams, customer landscapes, or comparison headers when rapid entity recognition materially reduces reading effort. Preserve aspect ratio, clear space, and legibility. Place each logo on a neutral backing only when contrast requires it; do not recolour a trademark to fit the palette unless the brand guidelines explicitly permit it.

Use one delivery-safe asset treatment for a peer set. For PowerPoint, prefer byte-embedded PNG assets when SVG support has not been proven in the exact target renderer; preserve the source SVG separately when useful. Do not mix blank or weakly supported SVG placeholders, raster logos, and bold typographic substitutes in one peer set. If one entity must fall back to text, render every peer through the same logo-plus-label geometry and label weight so the fallback reads as intentional rather than broken.

Asset validity is a rendered-output gate. Inspect every logo at full size in the exported PowerPoint render and confirm that the mark is non-blank, recognizable, sharp enough for its displayed size, and visually aligned with its peers. A source file that opens locally or an image object present in the PPTX does not prove that the logo renders correctly.

In hub-and-spoke or partnership diagrams, group peers by a named role before drawing connectors. Use no connectors when proximity and a central label already establish membership; otherwise use short orthogonal or deliberately routed connectors that terminate at node boundaries. Crossing radial lines, lines through labels, and decorative network spaghetti are release defects.

When a logo is absent from the [asset authorization record](#asset-authorization-record), use the organization name in the deck's label role. Do not invent a pseudo-logo, scrape a low-resolution mark, or substitute a generic icon that could be mistaken for the entity.

## Category icons and images

Images are optional at slide and deck level. Select them for evidence, a necessary concrete example, or a deliberate structural moment; there is no image-per-slide target. Do not let posters or stills consume analytical space while the argument remains in sparse captions. Removing unnecessary images must restore room for evidence, not produce empty placeholders.

For abstract categories, prefer compact semantic icons when they improve recognition. If concrete images earn their space, group each image, category label, and supporting evidence as one coherent card with a quiet theme-bound border when a visible enclosure is needed or requested. Do not leave the image as a detached banner above unrelated text. Use the same treatment for all peers, without turning every page into cards.

Choose one registered visual treatment for a category composition, normally three to five mutually exclusive peers:

- `icon-only` uses one semantic icon per category when every peer remains distinguishable at final rendered size without using its label to decode the icon;
- `image-only` uses one relevant image per category when concrete subject matter, place, product, or use context is more informative than an icon;
- `icon-image` uses one image plus one semantic icon per category when they perform distinct jobs, such as the image showing the concrete example while the icon reinforces the stable taxonomy.

Apply the selected treatment to every peer. An icon-led treatment requires an icon for every category; an image-led treatment requires an image for every category. Keep icon boxes, stroke width, optical size, baseline, label depth, and accent role identical across peers. Keep image frames, crop ratios, displayed heights, focal treatment, and visual weight consistent across peers. Omit an absent image or icon slot entirely rather than leaving a blank frame or placeholder.

The category label and evidence must carry the meaning. Icons should accelerate scanning and images should make the category more concrete. Use `icon-image` only when each visual contributes independent meaning; do not overlay or pair a generic icon with a photograph that already communicates the same idea. Retain source traceability for every image, preserve its aspect ratio, and use deliberate crops that remain recognizable in the exact final render. Do not use decorative stock imagery merely to fill the row.

Within one visual role, do not mix filled and outline icon families, photographic cutouts, emoji, and logos. A coordinated `icon-image` treatment may pair one consistent icon family with one consistent image treatment across all peers. Do not put each icon in a different accent colour unless hue is a declared category encoding used consistently elsewhere.

## Row and cell icons

Use compact icons when they make repeated rows or cells faster to scan. Suitable roles include category, binary, direction, completeness, risk, and availability. Pair icons with labels for nuanced or infrequent states. A standalone icon may replace repeated words only when a header or legend defines it and no exact value is hidden.

Keep a row icon inside the label cell rather than adding a decorative icon column. Center state icons within comparable cells and keep their box, optical size, stroke, baseline, and text gap consistent. Do not replace exact values, dates, owners, evidence qualifiers, or materially different status language with icons, and do not use several near-synonymous icons merely for variety. Route progress circles and one-to-five rubric marks through [`comparison-indicators`](comparison-indicators.md); semantic row and cell icons still follow the library and registry rules here.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| semantic icon | `--icon-color`, `--icon-size`, `--icon-stroke`, `--icon-bg` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| logo backing | `--logo-bg`, `--logo-border`, `--logo-padding`, `--logo-radius` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| image frame | `--image-bg`, `--image-border`, `--image-radius`, `--image-caption-font`, `--image-caption-color`, `--image-caption-gap` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| category composition | `--category-row-gap`, `--category-item-gap`, `--category-heading-gap`, `--category-rule`, `--category-padding-top`, `--category-image-ratio`, `--category-heading-font`, `--category-body-font`, `--category-body-color` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |

## Construction details

For `image-only`, omit the icon slot. For `icon-only`, omit the image slot. Collapse the absent slot instead of preserving empty space.

## Acceptance check

Give every mark a semantic or compositional purpose. Consider `icon-only`, `image-only`, and `icon-image` treatments. Retain visuals only when they improve differentiation, recognition, readability, balance, or scanning. Peers share one treatment, crop grammar, and registered icon system. Combined icons and images perform different jobs. Use actual Lucide vectors. Keep icon-only cells clear. Logos must be authorized, recognizable, and visible in the final render. Apply one fallback treatment for missing marks. Keep connectors clear of labels and unrelated nodes.

## Embedded image input

The registered `image-frame` component accepts `dataUri` (embedded PNG or JPEG), nonempty `alt`, and `authorization` referencing the asset record. Prepare the authorized crop at the target aspect ratio before embedding; both adapters preserve that rectangular crop. Omit `dataUri` only for an explicit planning placeholder. Quote avatars retain their separate circular treatment.

## Icon trends and logo collages

Use registered `icon-trends` for two to four independent trends. `columns` puts a sourced icon or image above each heading and explanation; `rows` gives longer explanations horizontal space. `image-columns` is the larger image-led counterpart of `columns`: full-column square images above the same headings and descriptions. It uses dedicated image assets rather than enlarging icons or removing their text. Each item requires `id`, `title`, `text` and `media`. Default to no connector. Set `connector: chevron` only when a directional relationship is real. Use one coherent asset treatment across peers.

Use `logo-collage` with one to twelve identified assets to show set membership. Logos stay small (at most 80 pixels on the structural canvas) and are centered in a compact multi-row grid by default; `layout: radial` distributes them around the section center. Avoid a straight logo strip. Choose the `grayscale` or `color` treatment consistently within a set. Supply authorized prepared assets under `mediaVariants.grayscale` and `mediaVariants.color`, or declare a matching `treatment` on a single asset; never recolor brands using the deck series palette. Preserve aspect ratios and equal visual weight. An explicit grid column count must retain multiple rows for three or more logos. For A/B ecosystems, place two collages under substantive headings in a row, optionally separated by the shared section boundary. Keep source dates and selection criteria visible; logo count and area do not encode market share.

The shared media renderer accepts embedded PNG/JPEG, intrinsic `width` and `height`, `alt`, and `authorization`; optional `sourceUrl` preserves traceability. It contains assets without distortion. Prepare intentional photographic crops before embedding. The bundled Lucide fixture is licensed demonstration artwork, not a substitute for choosing the right icon or obtaining actual logos. `runtime/media.mjs` owns these compositions and their token bindings.

For an area-filling rectangular collage, use `layout: collage` with a normalized `cell: {x,y,width,height}` on each item. Spread unequal cells across the full section to accommodate wide wordmarks, tall emblems and compact marks, following the reference composition. Cells must remain inside the section and must not overlap. The runtime contains each asset without stretching or cropping; individual marks remain modest (maximum 280 by 96 structural pixels), and whitespace supplies breathing room. This is an optical arrangement, never a market-share encoding. Both grayscale and color treatments use the same placement contract. Prefer the simpler grid when mixed silhouettes do not need an area composition.
