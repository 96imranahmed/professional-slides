// The media components. Among the core families, the media blocks
// (`registerMediaBlocks`): the image frame (an embedded picture, or the frame
// with its alt line until the picture is cleared), the icon in its ring and the
// logo. Registered later, once the components they extend exist
// (`registerMedia`): the sourced picture each of those and the divider,
// takeaways, statement and cover can carry, and the icon-trends and
// logo-collage components with their sample media. The media primitives they
// draw with are media.mjs's.
import { rectPrimitive, primitive, stableId, textPrimitive, insetFrame, token, tokenValue } from "./core.mjs";
import { iconMarker } from "./marks.mjs";
import { sampleImage, MEDIA_SAMPLE, WORDMARK_RECORDS, mediaNode } from "./media.mjs";
import { SECONDARY, MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS, LABEL, textStyle, boxStyle, component, INK, DISPLAY } from "./registry-shared.mjs";

function defineImageFrame() {
  return component({ id: "image-frame", category: "media", role: "image", tokens: ["color.surfaceMuted", "color.rule", "color.textSecondary", "font.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 520, height: 300 }, sample: { alt: "(Insert image)" }, render: ({ id, frame, props }) => { if (props.dataUri) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(props.dataUri) || !props.alt?.trim() || !props.authorization?.trim()) throw new Error("Image requires embedded PNG/JPEG, alt text and authorization");
    return { nodes: [primitive({ type: "image", id: stableId(id, "image"), role: "image", frame, data: { dataUri: props.dataUri, alt: props.alt, authorization: props.authorization, circular: false } })] };
  } return ({
    nodes: [
      rectPrimitive({
        id: stableId(id, "frame"),
        role: "image-frame",
        frame,
        style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS),
        data: { alt: props.alt }
      }),
      textPrimitive({
        id: stableId(id, "alt"),
        role: "image-alt",
        frame: { x: frame.x + 24, y: frame.y + frame.height / 2 - 18, width: frame.width - 48, height: 36 },
        text: props.alt,
        style: textStyle(LABEL, SECONDARY, true, "center")
      })
    ]
  }); } });
}

function defineIcon() {
  return component({
    id: "icon",
    category: "media",
    role: "icon",
    tokens: [
      "color.componentPrimary", "color.onPrimary", "color.ink", "color.surface", "font.body", "type.heading", "type.compact", "type.label",
      "line.hairline", "line.standard", "radius.round", "icon.medium"
    ],
    preferredSize: { width: 90, height: 90 },
    sample: { icon: "target", label: "(Insert label)" },
    render: ({ id, frame, props }) => {
      // A line icon in a ring (the deck's one icon treatment) with a label under
      // it. `symbol` (a glyph) is honoured for backwards compatibility.
      const size = Math.min(frame.width, props.label ? frame.height * 0.62 : frame.height);
      const x = frame.x + (frame.width - size) / 2;
      const nodes = iconMarker({ id: stableId(id, "mark"), role: "icon", x, y: frame.y, size, icon: props.icon || props.symbol, tone: props.tone || "outline" });
      if (props.label) nodes.push(textPrimitive({ id: stableId(id, "label"), role: "icon-label", frame: { x: frame.x, y: frame.y + size + 8, width: frame.width, height: frame.height - size - 8 }, text: props.label, style: textStyle(LABEL, INK, true, "center", "top") }));
      return { nodes };
    }
  });
}

function defineLogo() {
  return component({
    id: "logo",
    category: "media",
    role: "logo",
    tokens: ["color.surface", "color.rule", "color.ink", "font.display", "type.heading", "line.hairline", "radius.small"],
    preferredSize: { width: 220, height: 90 },
    sample: { text: "(Insert logo)" },
    render: ({ id, frame, props }) => ({
      nodes: [
        rectPrimitive({ id: stableId(id, "backing"), role: "logo-backing", frame, style: boxStyle() }),
        textPrimitive({
          id: stableId(id, "text"),
          role: "logo-text",
          frame: insetFrame(frame, 12),
          text: props.text,
          style: { ...textStyle(token("type.heading"), INK, true, "center"), fontFamily: DISPLAY }
        })
      ]
    })
  });
}

/** Media blocks: the image frame, icon and logo. */
export function registerMediaBlocks(registry) {
  const definitions = [defineImageFrame(), defineIcon(), defineLogo()];
  for (const definition of definitions) {
    registry.set(definition.id, definition);
  }
  return registry;
}

const loadAsset = (directory, name, alt, authorization, size = { width: 192, height: 192 }) => sampleImage(`${directory}/${name}.png`, { alt, authorization, ...size });
const TREND_MEDIA = [MEDIA_SAMPLE, ...['house','train-front','chart-no-axes-combined'].map(name => loadAsset('lucide',name,name,'Lucide ISC; assets/lucide/LICENSE'))];
const LOGO_MEDIA = ['github','python','rust','javascript'].map(name => ({
  mediaVariants: Object.fromEntries(['grayscale','color'].map(mode => [mode,loadAsset('simple-icons',name+'-'+mode,name,'Simple Icons CC0; assets/simple-icons/LICENSE.md; editorial identification')]))
}));
const WORDMARK_MEDIA=['visa','cisco','intel','samsung'].map(name=>{
  const record=WORDMARK_RECORDS.find(r=>r.name===name);
  return {mediaVariants:Object.fromEntries(['grayscale','color'].map(mode=>[mode,loadAsset('simple-icons',name+'-'+mode,name,'Simple Icons CC0; assets/simple-icons/LICENSE.md; editorial identification',{width:record.width,height:record.height})]))};
});
const COLLAGE_MEDIA=[WORDMARK_MEDIA[0],LOGO_MEDIA[0],WORDMARK_MEDIA[1],LOGO_MEDIA[1],WORDMARK_MEDIA[2],LOGO_MEDIA[2],WORDMARK_MEDIA[3],LOGO_MEDIA[3]];
const COLLAGE_CELLS=[
  {x:0,y:0,width:.32,height:.20},{x:.40,y:.04,width:.14,height:.24},
  {x:.65,y:0,width:.34,height:.28},{x:.03,y:.35,width:.15,height:.25},
  {x:.26,y:.37,width:.30,height:.20},{x:.68,y:.40,width:.13,height:.25},
  {x:.03,y:.77,width:.40,height:.20},{x:.86,y:.74,width:.10,height:.23}
];
const PEXELS = { alt: 'Abstract Pexels background', authorization: 'User-selected Pexels image; assets/pexels/source.json' };
const PEXELS_SOURCE = 'https://images.pexels.com/photos/7135013/pexels-photo-7135013.jpeg';
const IMAGE_MEDIA = sampleImage('pexels/category.png', { ...PEXELS, width: 480, height: 480, sourceUrl: PEXELS_SOURCE });
const COVER_MEDIA = sampleImage('pexels/cover.png', { ...PEXELS, width: 640, height: 720, sourceUrl: PEXELS_SOURCE });

const T = [
  "space.3",
  "space.4",
  "space.5",
  "color.rule",
  "line.hairline",
  "color.surfaceMuted",
  "color.componentPrimary",
  "color.onPrimary",
  "radius.none",
];

/**
 * The media components: each core component that can carry a sourced picture
 * learns to draw it (an image, icon or logo from its file; a divider,
 * takeaways page, statement or cover with a photograph), and the icon-trends
 * and logo-collage components are registered. A picture-bearing render wraps
 * the core one and falls back to it when the props carry no picture.
 */
export function registerMedia(registry) {
  withSourcedMedia(registry);
  withPhotoDivider(registry);
  withPhotoTakeaways(registry);
  withPhotoStatement(registry);
  withCoverVariants(registry);
  const tokens = [
    ...new Set([
      ...T,
      ...registry.get("paragraph").tokens,
      ...registry.get("section-heading").tokens,
      ...registry.get("bullet-list").tokens,
      ...registry.get("connector").tokens,
    ]),
  ];
  registerIconTrends(registry, tokens);
  registerLogoCollage(registry, tokens);
  return registry;
}

/** The image frame, icon and logo draw an embedded picture when their props carry one. */
function withSourcedMedia(registry) {
  const image = registry.get("image-frame");
  const imageRender = image.render;
  // `fit: "cover"` fills the frame and crops (a photo panel beside a chart).
  image.render = (input) =>
    input.props.dataUri && input.props.width
      ? { nodes: [mediaNode({ ...input, props: (({ fit, ...rest }) => rest)(input.props), id: stableId(input.id, "image"), fit: input.props.fit ?? "contain" })] }
      : imageRender(input);
  for (const name of ["icon", "logo"]) {
    const owner = registry.get(name),
      original = owner.render;
    owner.render = (input) =>
      input.props.dataUri
        ? { nodes: [mediaNode({ ...input, role: name })] }
        : original(input);
    owner.examples = {
      ...(owner.examples || {}),
      "sourced-media": { props: MEDIA_SAMPLE },
    };
  }
}

// A section divider with a sourced photograph: the title panel keeps the left
// 42% (navy or canvas by mode) and the photo fills the rest, cropped to fit;
// a numbered divider sets its numeral above the title.
function withPhotoDivider(registry) {
  const divider = registry.get("section-divider"), dividerRender = divider.render;
  divider.render = (input) => {
    const { image, ...props } = input.props;
    if (!image) return dividerRender(input);
    const { frame } = input;
    const panelWidth = Math.round(frame.width * 0.42);
    const base = dividerRender({ ...input, props: { ...props, panelWidth } });
    // The footer row is laid out for a page with nothing behind it, so on an
    // image divider it would land on the photograph, unreadable where the photo
    // is bright. The row moves, as one group, to end at the panel's right margin.
    const FURNITURE = new Set(["footer-right", "footer-left", "page-number", "source-text"]);
    const furniture = base.nodes.filter((node) => FURNITURE.has(node.role) && node.frame);
    const panelRight = frame.x + panelWidth - Math.round(frame.width * 0.025);
    const reach = furniture.length ? Math.max(...furniture.map((node) => node.frame.x + node.frame.width)) : 0;
    const shift = reach > frame.x + panelWidth ? panelRight - reach : 0;
    const nodes = shift ? base.nodes.map((node) => FURNITURE.has(node.role) && node.frame ? { ...node, frame: { ...node.frame, x: node.frame.x + shift } } : node) : base.nodes;
    return { ...base, nodes: [
      mediaNode({ id: stableId(input.id, "image"), frame: { x: frame.x + panelWidth, y: frame.y, width: frame.width - panelWidth, height: frame.height }, props: image, role: "divider-image", fit: "cover" }),
      ...nodes,
    ] };
  };
}

// A takeaways page with a photograph: the messages keep the left 60%, the photo the rest.
function withPhotoTakeaways(registry) {
  const takeaways = registry.get("takeaways"), takeawaysRender = takeaways.render;
  takeaways.render = (input) => {
    const { image, ...props } = input.props;
    if (!image) return takeawaysRender(input);
    const { frame } = input;
    const panelWidth = Math.round(frame.width * 0.6);
    const base = takeawaysRender({ ...input, props: { ...props, panelWidth } });
    return { ...base, nodes: [
      mediaNode({ id: stableId(input.id, "image"), frame: { x: frame.x + panelWidth, y: frame.y, width: frame.width - panelWidth, height: frame.height }, props: image, role: "takeaways-image", fit: "cover" }),
      ...base.nodes,
    ] };
  };
}

// A statement over a photograph: the photo fills the page and the sentence
// sits on a navy card in the middle (a keynote page).
function withPhotoStatement(registry) {
  const statement = registry.get("statement"), statementRender = statement.render;
  statement.render = (input) => {
    const { image, ...props } = input.props;
    if (!image) return statementRender(input);
    const { frame } = input;
    const card = { x: frame.x + frame.width * 0.17, y: frame.y + frame.height * 0.24, width: frame.width * 0.66, height: frame.height * 0.52 };
    const base = statementRender({ ...input, props: { ...props, card, mode: "dark" } });
    return { ...base, nodes: [
      mediaNode({ id: stableId(input.id, "image"), frame, props: image, role: "statement-image", fit: "cover" }),
      primitive({ type: "rect", id: stableId(input.id, "card"), role: "statement-card", frame: card, style: { fill: token("color.ink"), stroke: token("color.ink"), lineWidth: token("line.hairline"), radius: token("radius.none") } }),
      ...base.nodes,
    ] };
  };
}

// The cover's variants: plain, dark, and a photograph beside the title (half-image) or behind its card (full-image).
function withCoverVariants(registry) {
  const cover = registry.get("cover"),
    plain = cover.render;
  cover.variants = {
    plain: {},
    dark: { props: { title: "(Insert title)", subtitle: "(Insert subtitle)", tone: "dark" } },
    "half-image": {
      props: {
        title: "(Insert title)",
        subtitle: "(Insert subtitle)",
        image: COVER_MEDIA,
      },
    },
    "full-image": {
      props: {
        title: "(Insert title)",
        subtitle: "(Insert subtitle)",
        image: COVER_MEDIA,
        variant: "full-image",
      },
    },
  };
  cover.defaultVariant = "dark";
  cover.variantProp = "variant";
  cover.resolveVariant = (props) => {
    const value = props.variant ?? "dark";
    if (!Object.hasOwn(cover.variants, value))
      throw new Error("Unknown cover variant");
    return value;
  };
  cover.render = (input) => {
    const { variant, image, ...props } = input.props;
    const resolved = cover.resolveVariant(input.props);
    if (resolved !== "half-image" && resolved !== "full-image") {
      if (image) throw new Error("Cover image requires half-image or full-image variant");
      return plain({ ...input, props: { ...props, tone: resolved === "dark" ? "dark" : "light" } });
    }
    if (!image) throw new Error("Image cover requires sourced image");
    if (resolved === "full-image") {
      // The 2023–24 cover: a full-bleed photograph with the title on a card in the
      // lower left (white by default, navy with `tone: "dark"`), as modern covers set
      // theirs. The card takes half the page each way; the plain cover renders into it.
      const { frame } = input;
      const margin = 48, pad = 40;
      const tone = props.tone ?? "light";
      const fill = tone === "dark" ? token("color.ink") : token("color.canvas");
      // Size the card from its content: render once into a provisional frame,
      // read the text block's extent, then fit the card to it with even padding.
      const probeFrame = { x: frame.x + margin, y: frame.y, width: frame.width * 0.52, height: frame.height };
      const probed = plain({ ...input, frame: probeFrame, props: { ...props, tone } }).nodes.filter((n) => n.role !== "cover-surface");
      const logo = probed.find((n) => n.role === "cover-logo");
      const block = probed.filter((n) => n !== logo);
      const top = Math.min(...block.map((n) => n.frame.y)), bottom = Math.max(...block.map((n) => n.frame.y + n.frame.height));
      const logoBand = logo ? logo.frame.height + 28 : 0;
      const cardHeight = pad + logoBand + (bottom - top) + pad;
      const card = { x: frame.x + margin, y: frame.y + frame.height - margin - cardHeight, width: frame.width * 0.52, height: cardHeight };
      const shift = card.y + pad + logoBand - top;
      const inner = probed.map((n) => {
        const dy = n === logo ? card.y + pad - n.frame.y : shift;
        const moved = { ...n, frame: { ...n.frame, y: n.frame.y + dy } };
        if (n.type === "line") moved.data = { ...n.data, y1: n.data.y1 + dy, y2: n.data.y2 + dy };
        return moved;
      });
      return {
        nodes: [
          mediaNode({ id: stableId(input.id, "image"), frame, props: image, role: "cover-image", fit: "cover" }),
          primitive({ type: "rect", id: stableId(input.id, "card"), role: "cover-card", frame: card, style: { fill, stroke: fill, lineWidth: token("line.hairline"), radius: token("radius.none") } }),
          ...inner,
        ],
      };
    }
    const half = input.frame.width / 2;
    return {
      nodes: [
        ...plain({ ...input, frame: { ...input.frame, width: half }, props: { ...props, tone: props.tone ?? "light" } })
          .nodes,
        mediaNode({
          id: stableId(input.id, "image"),
          frame: {
            x: input.frame.x + half,
            y: input.frame.y,
            width: half,
            height: input.frame.height,
          },
          props: image,
          role: "cover-image",
          fit: "cover",
        }),
      ],
    };
  };
}

// Icon trends: four trends, each a picture with its title and evidence.
function registerIconTrends(registry, tokens) {
  const items = [1, 2, 3, 4].map((i) => ({
    id: `trend-${i}`,
    title: `(Insert trend ${i})`,
    text: "(Insert supporting evidence.)",
    media: TREND_MEDIA[i-1],
  }));
  registry.set("icon-trends", {
    id: "icon-trends",
    version: "1.0.0",
    category: "media",
    role: "icon-trends",
    tokens,
    preferredSize: { width: 1160, height: 460 },
    sample: { items },
    guidance: {
      useWhen: "comparing independent trends with recognizable subjects",
      why: "sourced icons or images identify each subject while editable text develops its evidence",
      actionTitle: "state the shared consequence of the trends",
    },
    variants: { columns: {}, rows: {}, "image-columns": {props:{items:items.map(item=>({...item,media:IMAGE_MEDIA}))}} },
    defaultVariant: "columns",
    variantProp: "variant",
    resolveVariant(props = {}) {
      const v = props.variant ?? "columns";
      if (!["columns", "rows", "image-columns"].includes(v))
        throw new Error("Unknown icon-trends variant");
      return v;
    },
    render({ id, frame, props, tokens }) {
      const variant = registry.get("icon-trends").resolveVariant(props),
        items = props.items;
      if (
        !Array.isArray(items) ||
        items.length < 2 ||
        items.length > 4 ||
        new Set(items.map((i) => i.id)).size !== items.length ||
        items.some((i) => !i.id || !i.text)
      )
        throw new Error(
          "Icon trends require two to four identified evidence items",
        );
      if (
        props.connector !== undefined &&
        !["none", "chevron"].includes(props.connector)
      )
        throw new Error("Trend connectors must be none or chevron");
      const gap = tokenValue(token("space.5")),
        nodes = [];
      items.forEach((item, i) => {
        const column = variant !== "rows";
        const width = column
          ? (frame.width - gap * (items.length - 1)) / items.length
          : frame.width;
        const height = column
          ? frame.height
          : (frame.height - gap * (items.length - 1)) / items.length;
        const x = frame.x + (column ? i * (width + gap) : 0),
          y = frame.y + (column ? 0 : i * (height + gap));
        const iconSize = Math.min(column ? (variant === "image-columns" ? width : 100) : height, column ? width : 100);
        const mediaFrame = {
          x: column ? x + (width - iconSize) / 2 : x,
          y,
          width: iconSize,
          height: iconSize,
        };
        nodes.push(
          mediaNode({
            id: stableId(id, item.id, "media"),
            frame: mediaFrame,
            props: item.media,
            role: "trend-media",
          }),
        );
        const textX = column ? x : x + iconSize + gap,
          textWidth = column ? width : width - iconSize - gap;
        let textY = column ? y + iconSize + gap : y;
        if (column && props.connector === "chevron") {
          nodes.push(
            ...registry
              .get("connector")
              .render({
                id: stableId(id, item.id, "connector"),
                frame: {
                  x: x + width / 2 - 12,
                  y: textY,
                  width: 24,
                  height: 24,
                },
                props: { variant: "chevron" },
                tokens,
              }).nodes,
          );
          textY += 24 + gap;
        }
        const heading = registry.get("section-heading"),
          hp = { heading: item.title, rule: false };
        const hh = item.title ? heading.measureHeader({
          frame: { x: textX, y: textY, width: textWidth, height },
          props: hp,
        }).height : 0;
        if(item.title) nodes.push(
          ...heading.render({
            id: stableId(id, item.id, "heading"),
            frame: { x: textX, y: textY, width: textWidth, height: hh + gap },
            props: hp,
            tokens,
          }).nodes,
        );
        const bodyY = textY + hh + (item.title ? tokenValue(token("space.3")) : 0);
        if (bodyY >= y + height)
          throw new Error("Icon trends need more height");
        nodes.push(
          ...registry
            .get("paragraph")
            .render({
              id: stableId(id, item.id, "body"),
              frame: {
                x: textX,
                y: bodyY,
                width: textWidth,
                height: y + height - bodyY,
              },
              props: { text: item.text },
              tokens,
            }).nodes,
        );
      });
      if (props.verticalAlign !== undefined && !["center", "top"].includes(props.verticalAlign)) throw new Error("Icon trends verticalAlign must be center or top");
      if (variant !== "rows" && props.verticalAlign !== "top") {
        for (const node of nodes) if (node.type === "text" && node.data.textLayout) node.frame.height = node.data.textLayout.height;
        const bottom = Math.max(...nodes.map(node => node.frame.y + node.frame.height));
        const shift = (frame.height - (bottom - frame.y)) / 2;
        for (const node of nodes) {
          node.frame.y += shift;
          if (node.type === "line") { node.data.y1 += shift; node.data.y2 += shift; }
        }
      }
      return { nodes };
    },
  });
}

// A logo collage: wordmarks and logos set in a wall of cells.
function registerLogoCollage(registry, tokens) {
  registry.set("logo-collage", {
    id: "logo-collage",
    version: "1.0.0",
    category: "media",
    role: "logo-collage",
    variants: {grayscale:{},color:{}},
    defaultVariant: "grayscale",
    variantProp: "variant",
    resolveVariant(props={}) {
      const variant=props.variant??"grayscale";
      if(!["grayscale","color"].includes(variant)) throw new Error("Unknown logo treatment");
      return variant;
    },
    examples: {
      "area-grayscale":{props:{layout:"collage",variant:"grayscale",items:COLLAGE_MEDIA.map((media,i)=>({id:`collage-${i}`,...media,cell:COLLAGE_CELLS[i]}))}},
      "area-color":{props:{layout:"collage",variant:"color",items:COLLAGE_MEDIA.map((media,i)=>({id:`collage-${i}`,...media,cell:COLLAGE_CELLS[i]}))}},
      "radial-grayscale":{props:{layout:"radial",variant:"grayscale",items:LOGO_MEDIA.map((media,i)=>({id:`radial-${i}`,...media}))}},
      "radial-color":{props:{layout:"radial",variant:"color",items:LOGO_MEDIA.map((media,i)=>({id:`radial-${i}`,...media}))}}
    },
    tokens,
    preferredSize: { width: 1160, height: 400 },
    sample: {
      items: [1, 2, 3, 4].map((i) => ({ id: `brand-${i}`, ...LOGO_MEDIA[i-1] })),
    },
    guidance: {
      useWhen: "showing the membership of an employer, customer or partner set",
      why: "sourced marks make a bounded group recognizable without implying market share",
      actionTitle: "state the membership or ecosystem distinction",
    },
    render({ id, frame, props }) {
      const items = props.items;
      if (
        !Array.isArray(items) ||
        !items.length ||
        items.length > 12 ||
        new Set(items.map((i) => i.id)).size !== items.length ||
        items.some((i) => !i.id)
      )
        throw new Error(
          "Logo collage requires one to twelve uniquely identified assets",
        );
      const variant=registry.get("logo-collage").resolveVariant(props);
      const layout=props.layout??"grid";
      if(!["grid","radial","collage"].includes(layout)) throw new Error("Logo collage layout must be grid, radial or collage");
      const gap=tokenValue(token("space.5"));
      const size=Math.min(80,frame.width/4,frame.height/3);
      if(size<40) throw new Error("Logo collage is too dense");
      let frames;
      if(layout==="grid") {
        const columns=props.columns??Math.ceil(Math.sqrt(items.length));
        if(!Number.isInteger(columns)||columns<1||columns>items.length)
          throw new Error("Invalid logo collage columns");
        const rows=Math.ceil(items.length/columns);
        if(items.length>=3&&rows===1) throw new Error("Use multiple logo grid rows");
        const width=columns*size+(columns-1)*gap,height=rows*size+(rows-1)*gap;
        if(width>frame.width||height>frame.height) throw new Error("Logo collage is too dense");
        frames=items.map((_,i)=>({x:frame.x+(frame.width-width)/2+(i%columns)*(size+gap),y:frame.y+(frame.height-height)/2+Math.floor(i/columns)*(size+gap),width:size,height:size}));
      } else if(layout==="collage") {
        if(items.some(item=>!item.cell)) throw new Error("Area collage requires a normalized cell for every logo");
        frames=items.map(item=>{
          const c=item.cell;
          if(![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1||c.y+c.height>1)
            throw new Error("Collage cells must stay inside the normalized rectangle");
          return {x:frame.x+c.x*frame.width,y:frame.y+c.y*frame.height,width:c.width*frame.width,height:c.height*frame.height};
        });
        for(let i=0;i<frames.length;i++) for(let j=i+1;j<frames.length;j++){
          const a=frames[i],b=frames[j];
          if(Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y))
            throw new Error("Collage cells must not overlap");
        }
        frames=frames.map(f=>{
          const width=Math.min(f.width,280),height=Math.min(f.height,96);
          return {x:f.x+(f.width-width)/2,y:f.y+(f.height-height)/2,width,height};
        });
      } else {
        const radius=items.length===1?0:Math.min(160,(frame.width-size)/2,(frame.height-size)/2);
        if(items.length>1&&2*radius*Math.sin(Math.PI/items.length)<Math.SQRT2*size+gap)
          throw new Error("Radial logo collage is too dense; enlarge the section or use a grid");
        frames=items.map((_,i)=>{
          const angle=-Math.PI/2+2*Math.PI*i/items.length;
          return {x:frame.x+frame.width/2+radius*Math.cos(angle)-size/2,y:frame.y+frame.height/2+radius*Math.sin(angle)-size/2,width:size,height:size};
        });
      }
      return {nodes:items.map((item,i)=>{
        const media=item.mediaVariants?.[variant]??(item.treatment===variant?item:null);
        if(!media) throw new Error("Supply prepared logo media for the selected treatment");
        return mediaNode({id:stableId(id,item.id),role:"logo",frame:frames[i],props:media});
      })};
    },
  });
}
