import { readFileSync } from "node:fs";
import { primitive, stableId, token, tokenValue } from "./core.mjs";

const iconData = `data:image/png;base64,${readFileSync(new URL("../assets/lucide/briefcase-business.png", import.meta.url)).toString("base64")}`;
export const MEDIA_SAMPLE = Object.freeze({
  dataUri: iconData,
  alt: "Briefcase",
  authorization: "Lucide ISC license; assets/lucide/LICENSE",
  sourceUrl:
    "https://github.com/lucide-icons/lucide/blob/main/icons/briefcase-business.svg",
  width: 192,
  height: 192,
});
const loadAsset = (directory, name, alt, authorization) => ({
  dataUri: `data:image/png;base64,${readFileSync(new URL(`../assets/${directory}/${name}.png`, import.meta.url)).toString('base64')}`,
  alt, authorization, width:192, height:192
});
const TREND_MEDIA = [MEDIA_SAMPLE, ...['house','train-front','chart-no-axes-combined'].map(name => loadAsset('lucide',name,name,'Lucide ISC; assets/lucide/LICENSE'))];
const LOGO_MEDIA = ['github','python','rust','javascript'].map(name => ({
  mediaVariants: Object.fromEntries(['grayscale','color'].map(mode => [mode,loadAsset('simple-icons',name+'-'+mode,name,'Simple Icons CC0; assets/simple-icons/LICENSE.md; editorial identification')]))
}));
const IMAGE_MEDIA = {...loadAsset('pexels','category','Abstract Pexels background','User-selected Pexels image; assets/pexels/source.json'),width:480,height:480,sourceUrl:'https://images.pexels.com/photos/7135013/pexels-photo-7135013.jpeg'};
const COVER_MEDIA = {...IMAGE_MEDIA,...loadAsset('pexels','cover','Abstract Pexels background','User-selected Pexels image; assets/pexels/source.json'),width:640,height:720};

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

export function mediaNode({ id, frame, props, role = "image" }) {
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

export function registerMedia(registry) {
  const image = registry.get("image-frame");
  const imageRender = image.render;
  image.render = (input) =>
    input.props.dataUri && input.props.width
      ? { nodes: [mediaNode({ ...input, id: stableId(input.id, "image") })] }
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
  const cover = registry.get("cover"),
    plain = cover.render;
  cover.variants = {
    plain: {},
    "half-image": {
      props: {
        title: "(Insert title)",
        subtitle: "(Insert subtitle)",
        image: COVER_MEDIA,
      },
    },
  };
  cover.defaultVariant = "plain";
  cover.variantProp = "variant";
  cover.resolveVariant = (props) => {
    const value = props.variant ?? "plain";
    if (!Object.hasOwn(cover.variants, value))
      throw new Error("Unknown cover variant");
    return value;
  };
  cover.render = (input) => {
    const { variant, image, ...props } = input.props;
    if (cover.resolveVariant(input.props) === "plain") {
      if (image) throw new Error("Cover image requires half-image variant");
      return plain({ ...input, props });
    }
    if (!image) throw new Error("Half-image cover requires sourced image");
    const half = input.frame.width / 2;
    return {
      nodes: [
        ...plain({ ...input, frame: { ...input.frame, width: half }, props })
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
        }),
      ],
    };
  };
  const tokens = [
    ...new Set([
      ...T,
      ...registry.get("paragraph").tokens,
      ...registry.get("section-heading").tokens,
      ...registry.get("bullet-list").tokens,
      ...registry.get("connector").tokens,
    ]),
  ];
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
        items.some((i) => !i.id || !i.title || !i.text)
      )
        throw new Error(
          "Icon trends require two to four identified, titled evidence items",
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
        const hh = heading.measureHeader({
          frame: { x: textX, y: textY, width: textWidth, height },
          props: hp,
        }).height;
        nodes.push(
          ...heading.render({
            id: stableId(id, item.id, "heading"),
            frame: { x: textX, y: textY, width: textWidth, height: hh + gap },
            props: hp,
            tokens,
          }).nodes,
        );
        const bodyY = textY + hh + tokenValue(token("space.3"));
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
      return { nodes };
    },
  });
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
      if(!["grid","radial"].includes(layout)) throw new Error("Logo collage layout must be grid or radial");
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
  return registry;
}
