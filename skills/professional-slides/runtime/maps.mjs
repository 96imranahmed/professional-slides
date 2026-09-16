import {
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { NATURAL_EARTH_COUNTRIES, NATURAL_EARTH_SOURCE } from "./natural-earth-map-data.mjs";
import { measureText } from './text-layout.mjs';
import { MARK_TOKENS, markerSize, numberMarker } from './marks.mjs';
import { normalizeQuantitativeScale, quantitativeScaleColor, quantitativeLegendNodes, QUANTITATIVE_SCALE_TOKENS } from './legends.mjs';

const SURFACE = token("color.surface");
const MUTED_SURFACE = token("color.surfaceMuted");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const HAIRLINE = token("line.hairline");
const LABEL = token("type.label");
const FONT = token("font.body");

const MIDDLE_EAST = Object.freeze(["ARE", "BHR", "CYP", "EGY", "IRN", "IRQ", "ISR", "JOR", "KWT", "LBN", "OMN", "PSX", "QAT", "SAU", "SYR", "TUR", "YEM"]);
const MENA = Object.freeze([...MIDDLE_EAST, "DZA", "LBY", "MAR", "SAH", "SDN", "TUN"]);
const GCC = Object.freeze(["ARE", "BHR", "KWT", "OMN", "QAT", "SAU"]);

const preset = (title, bounds, criteria, aliases = []) => Object.freeze({ title, bounds: Object.freeze(bounds), criteria: Object.freeze(criteria), aliases: Object.freeze(aliases) });

export const MAP_PRESETS = Object.freeze({
  world: preset("World", [-180, -58, 180, 84], { all: true, exclude: ["ATA"] }, ["global", "worldwide"]),
  usa: preset("United States", [-179, 17, -64, 72], { include: ["USA"] }, ["us", "u-s", "u-s-a", "united-states", "united-states-of-america"]),
  "usa-contiguous": preset("Contiguous United States", [-126, 23, -66, 50], { include: ["USA"] }, ["lower-48", "continental-us", "contiguous-us"]),
  canada: preset("Canada", [-142, 40, -50, 84], { include: ["CAN"] }),
  brazil: preset("Brazil", [-75, -35, -32, 7], { include: ["BRA"] }),
  "north-america": preset("North America", [-170, 5, -50, 84], { continents: ["North America"] }, ["northern-america"]),
  "south-america": preset("South America", [-86, -58, -32, 14], { continents: ["South America"] }),
  "latin-america": preset("Latin America and the Caribbean", [-120, -58, -32, 33], { continents: ["South America"], subregions: ["Central America", "Caribbean"], include: ["MEX"] }, ["latin-america-and-caribbean", "lac"]),
  americas: preset("Americas", [-170, -58, -32, 84], { continents: ["North America", "South America"] }),
  europe: preset("Europe", [-25, 34, 45, 72], { continents: ["Europe"], include: ["CYP", "TUR"] }),
  "united-kingdom": preset("United Kingdom", [-11, 49, 3, 61], { include: ["GBR"] }, ["uk", "u-k"]),
  mena: preset("Middle East and North Africa", [-20, 10, 65, 43], { include: MENA }, ["middle-east-and-north-africa", "middle-east-north-africa"]),
  "middle-east": preset("Middle East", [23, 10, 65, 43], { include: MIDDLE_EAST }),
  gcc: preset("Gulf Cooperation Council", [33, 10, 60, 33], { include: GCC }, ["gulf-cooperation-council"]),
  africa: preset("Africa", [-20, -36, 53, 38], { continents: ["Africa"] }),
  "sub-saharan-africa": preset("Sub-Saharan Africa", [-20, -36, 53, 18], { continents: ["Africa"], excludeSubregions: ["Northern Africa"] }, ["ssa"]),
  asia: preset("Asia", [24, -12, 180, 82], { continents: ["Asia"] }),
  "asia-pacific": preset("Asia-Pacific", [60, -50, 180, 60], { continents: ["Oceania"], subregions: ["Eastern Asia", "South-Eastern Asia", "Southern Asia"] }, ["apac", "asia-pacific-region"]),
  oceania: preset("Oceania", [108, -50, 180, 8], { continents: ["Oceania"] }, ["australasia"]),
  emea: preset("Europe, Middle East and Africa", [-25, -40, 65, 72], { continents: ["Europe", "Africa"], include: MIDDLE_EAST }, ["europe-middle-east-and-africa"]),
  china: preset("China", [72, 17, 136, 55], { include: ["CHN"] }),
  india: preset("India", [66, 5, 99, 38], { include: ["IND"] }),
  australia: preset("Australia", [111, -45, 155, -9], { include: ["AUS"] }),
  japan: preset("Japan", [127, 29, 147, 47], { include: ["JPN"] })
});

export const MAP_PRESET_IDS = Object.freeze(Object.keys(MAP_PRESETS));
export const MAP_TOKENS = Object.freeze([
  ...MARK_TOKENS,
  ...QUANTITATIVE_SCALE_TOKENS, 'type.chartLabel', 'space.2',
  "color.surface",
  "color.rule",
  "color.surfaceMuted",
  "color.ink",
  "color.textSecondary",
  "color.componentPrimary",
  "font.body",
  "type.label",
  "line.hairline",
  "radius.round",
  "radius.none",
  "radius.small"
]);
export const MAP_GUIDANCE = Object.freeze({
  useWhen: "showing geographic distribution, market coverage, regional differences or a location-bound priority",
  why: "a consistent real-world outline makes concentration, gaps and selected markets immediately recognizable without decorative geography",
  actionTitle: "state the geographic concentration, difference or coverage implication rather than naming the map"
});
export { NATURAL_EARTH_SOURCE };

function normalizedKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PRESET_ALIASES = new Map(MAP_PRESET_IDS.flatMap((id) => [[normalizedKey(id), id], ...MAP_PRESETS[id].aliases.map((alias) => [normalizedKey(alias), id])]));
const COUNTRY_BY_ID = new Map(NATURAL_EARTH_COUNTRIES.map((country) => [country.id, country]));
const COUNTRY_ALIASES = new Map(NATURAL_EARTH_COUNTRIES.flatMap((country) => [[country.id.toLowerCase(), country.id], [normalizedKey(country.name), country.id]]));

function resolveCountryId(value) {
  const text = String(value ?? "").trim();
  const byId = text.toUpperCase();
  const id = COUNTRY_BY_ID.has(byId) ? byId : COUNTRY_ALIASES.get(normalizedKey(text));
  if (!id) throw new Error(`Unknown Natural Earth country: ${value}`);
  return id;
}

export function resolveGeography(value = "world") {
  if (value && typeof value === "object") return customGeography(value);
  const text = String(value ?? "world").trim();
  const countryMatch = text.match(/^country\s*:\s*(.+)$/i);
  if (countryMatch) {
    const id = resolveCountryId(countryMatch[1]);
    const country = unwrapCountry(COUNTRY_BY_ID.get(id));
    return Object.freeze({ id: `country:${id}`, title: country.name, bounds: automaticBounds([country]), countries: Object.freeze([country]) });
  }
  const presetId = PRESET_ALIASES.get(normalizedKey(text));
  if (!presetId) throw new Error(`Unknown map geography: ${value}`);
  const definition = MAP_PRESETS[presetId];
  const countries = NATURAL_EARTH_COUNTRIES.filter((country) => countryMatches(country, definition.criteria));
  if (!countries.length) throw new Error(`Map geography has no countries: ${presetId}`);
  return Object.freeze({ id: presetId, title: definition.title, bounds: definition.bounds, countries: Object.freeze(countries) });
}

// Geometry is downloaded and converted before compilation; renderers never fetch.
function customGeography(value) {
  const { id, title, source, geojson } = value;
  if (!id || !title || !source?.url || !/^https?:\/\//.test(source.url) || !source.license || !/^[a-f0-9]{64}$/i.test(source.sha256 || "")) throw new Error("Custom geography requires id, title and source URL, license and SHA-256");
  if (geojson?.type !== "FeatureCollection" || !geojson.features?.length) throw new Error("Custom map requires a WGS84 GeoJSON FeatureCollection");
  if (geojson.crs) throw new Error("Reproject custom geometry to RFC 7946 WGS84 before import");
  const ids = new Set();
  const countries = geojson.features.map((feature, index) => {
    const featureId = String(feature.id ?? feature.properties?.id ?? "");
    if (!featureId || ids.has(featureId)) throw new Error("Custom features require unique stable ids");
    ids.add(featureId);
    const geometry = feature.geometry;
    if (!["Polygon", "MultiPolygon"].includes(geometry?.type)) throw new Error("Custom maps support Polygon and MultiPolygon features");
    if (!Array.isArray(geometry.coordinates)) throw new Error("Custom geometry requires coordinates");
    const groups = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    if (!groups.length || groups.some(group => !Array.isArray(group) || !group.length)) throw new Error("Custom polygon has no rings");
    const polygons = groups.flat();
    if (!Array.isArray(polygons) || !polygons.length) throw new Error("Custom feature has no rings");
    for (const ring of polygons) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.some(point => !Array.isArray(point) || point.length < 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)) throw new Error("Custom rings require closed WGS84 longitude/latitude coordinates");
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error("Custom polygon ring is not closed");
      if (ring.some((point, i) => i && Math.abs(point[0] - ring[i-1][0]) > 180)) throw new Error("Split antimeridian-crossing custom geometry before import");
    }
    // Ring order determines holes even when the input winding is noncanonical.
    const oriented = groups.flatMap(group => group.map((ring, index) => {
      const xy = ring.map(point => point.slice(0, 2));
      const area = xy.slice(1).reduce((sum, point, i) => sum + xy[i][0] * point[1] - point[0] * xy[i][1], 0);
      if (!area) throw new Error("Custom polygon ring has zero area");
      return (area > 0) === (index === 0) ? xy : xy.reverse();
    }));
    const name=feature.properties?.name || featureId, labelText=feature.properties?.labelText ?? name;
    if (typeof labelText!=='string' || labelText.replace(/\s/g,'')!==name.replace(/\s/g,'')) throw new Error('Custom feature labelText may only add line breaks to its full name');
    return { id: featureId, name, labelText, polygons: oriented, source, label:feature.properties?.labelPoint };
  });
  const points = countries.flatMap(c => c.polygons.flat());
  const [minX,minY,maxX,maxY] = points.reduce((b,p) => [Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
  const padX = Math.max(.001, (maxX-minX)*.08), padY = Math.max(.001, (maxY-minY)*.08);
  const bounds = value.bounds || [Math.max(-180,minX-padX),Math.max(-90,minY-padY),Math.min(180,maxX+padX),Math.min(90,maxY+padY)];
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0]>=bounds[2] || bounds[1]>=bounds[3] || bounds[0]<-180 || bounds[2]>180 || bounds[1]<-90 || bounds[3]>90) throw new Error("Invalid custom geography bounds");
  return { id: `custom:${id}`, title, bounds, countries, source, custom: true };
}

function countryMatches(country, criteria) {
  const included = criteria.all === true
    || criteria.include?.includes(country.id)
    || criteria.continents?.includes(country.continent)
    || criteria.regions?.includes(country.region)
    || criteria.subregions?.includes(country.subregion);
  return Boolean(included)
    && !criteria.exclude?.includes(country.id)
    && !criteria.excludeContinents?.includes(country.continent)
    && !criteria.excludeSubregions?.includes(country.subregion);
}

function automaticBounds(countries) {
  const coordinates = countries.flatMap((country) => country.polygons.flat());
  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);
  const minLon = Math.min(...longitudes), maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
  const padLon = Math.max(1, (maxLon - minLon) * 0.08);
  const padLat = Math.max(1, (maxLat - minLat) * 0.08);
  return Object.freeze([minLon - padLon, Math.max(-90, minLat - padLat), maxLon + padLon, Math.min(90, maxLat + padLat)]);
}

// Country crops use the smallest circular longitude interval. Preset world
// maps retain their conventional -180..180 split; source records stay intact.
function unwrapCountry(country) {
  const longitudes = [...new Set(country.polygons.flat().map(point => point[0]))].sort((a, b) => a - b);
  if (longitudes.at(-1) - longitudes[0] <= 180) return country;
  let gap = -1, start = longitudes[0];
  longitudes.forEach((longitude, index) => {
    const next = longitudes[(index + 1) % longitudes.length] + (index === longitudes.length - 1 ? 360 : 0);
    if (next - longitude > gap) { gap = next - longitude; start = next > 180 ? next - 360 : next; }
  });
  const unwrap = ([longitude, latitude]) => [longitude < start ? longitude + 360 : longitude, latitude];
  return { ...country, label: country.label ? unwrap(country.label) : null, polygons: country.polygons.map(ring => ring.map(unwrap)) };
}

function clipAgainst(points, inside, intersection) {
  const output = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index], previous = points[(index + points.length - 1) % points.length];
    const currentInside = inside(current), previousInside = inside(previous);
    if (currentInside) {
      if (!previousInside) output.push(intersection(previous, current));
      output.push(current);
    } else if (previousInside) output.push(intersection(previous, current));
  }
  return output;
}

function clipRing(points, bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  let output = points;
  const vertical = (x) => (a, b) => {
    const ratio = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (b[1] - a[1]) * ratio];
  };
  const horizontal = (y) => (a, b) => {
    const ratio = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * ratio, y];
  };
  output = clipAgainst(output, ([x]) => x >= minLon, vertical(minLon));
  output = clipAgainst(output, ([x]) => x <= maxLon, vertical(maxLon));
  output = clipAgainst(output, ([, y]) => y >= minLat, horizontal(minLat));
  output = clipAgainst(output, ([, y]) => y <= maxLat, horizontal(maxLat));
  return output.filter((point, index) => !index || Math.abs(point[0] - output[index - 1][0]) > 1e-7 || Math.abs(point[1] - output[index - 1][1]) > 1e-7);
}

function projection(frame, bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const longitudeScale = Math.max(0.25, Math.cos(((minLat + maxLat) / 2) * Math.PI / 180));
  const projectedWidth = (maxLon - minLon) * longitudeScale;
  const projectedHeight = maxLat - minLat;
  const padding = Math.min(tokenValue(token("space.4")), frame.width * 0.04, frame.height * 0.04);
  const available = { x: frame.x + padding, y: frame.y + padding, width: frame.width - padding * 2, height: frame.height - padding * 2 };
  const scale = Math.min(available.width / projectedWidth, available.height / projectedHeight);
  const width = projectedWidth * scale, height = projectedHeight * scale;
  const plot = { x: available.x + (available.width - width) / 2, y: available.y + (available.height - height) / 2, width, height };
  const project = ([longitude, latitude]) => [plot.x + (longitude - minLon) * longitudeScale * scale, plot.y + (maxLat - latitude) * scale];
  return { plot, project, contains: ([longitude, latitude]) => longitude >= minLon && longitude <= maxLon && latitude >= minLat && latitude <= maxLat };
}

function polygonNode({ id, country, paths, highlighted, quantitative }) {
  const points = paths.flat();
  const [x,y,maxX,maxY] = points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
  const width=maxX-x, height=maxY-y;
  if (width < 0.35 || height < 0.35) return null;
  const normalized = paths.map((path) => path.map(([px, py]) => [Number(((px - x) / width).toFixed(6)), Number(((py - y) / height).toFixed(6))]));
  const fill = quantitative ? quantitativeScaleColor(quantitative.scale,quantitative.value) : highlighted ? PRIMARY : MUTED_SURFACE;
  return shapePrimitive({
    id: stableId(id, "land", country.id),
    role: "map-land",
    geometry: "customPolygon",
    frame: { x, y, width, height },
    style: { fill, stroke: quantitative ? token("color.rule") : SURFACE, lineWidth: HAIRLINE, radius: token("radius.none") },
    data: {
      paths: normalized,
      countryId: country.id,
      countryName: country.name,
      highlighted,
      ...(quantitative ? {featureId:country.id,value:quantitative.value,unit:quantitative.scale.unit,domain:quantitative.scale.domain,palette:quantitative.scale.palette,scaleSemantics:quantitative.scale.semantics??null,bin:Math.round((quantitative.value-quantitative.scale.domain[0])/(quantitative.scale.domain[1]-quantitative.scale.domain[0])*10)} : {}),
      source: country.source?.name || country.source?.url || NATURAL_EARTH_SOURCE.name,
      sourceUrl: country.source?.url || NATURAL_EARTH_SOURCE.url,
      sourceSha256: country.source?.sha256,
      sourceLicense: country.source?.license,
      sourceCommit: country.source ? undefined : NATURAL_EARTH_SOURCE.commit
    }
  });
}

function markerCoordinate(marker, geography, projected) {
  if (marker.longitude !== undefined || marker.latitude !== undefined) {
    if (!Number.isFinite(marker.longitude) || !Number.isFinite(marker.latitude) || !projected.contains([marker.longitude, marker.latitude])) throw new Error("Map longitude/latitude marker is outside the crop");
    return projected.project([marker.longitude, marker.latitude]);
  }
  if (marker.country) {
    const id = geography.custom ? String(marker.country) : resolveCountryId(marker.country);
    const country = geography.countries.find((candidate) => candidate.id === id);
    if (!country) throw new Error(`Map marker country ${id} is outside ${geography.id}`);
    if (!country.label || !projected.contains(country.label)) throw new Error(`Map marker country ${id} has no visible label point`);
    return projected.project(country.label);
  }
  if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y) || marker.x < 0 || marker.x > 1 || marker.y < 0 || marker.y > 1) throw new Error("Map markers require a country or unit x and y coordinates");
  return [projected.plot.x + marker.x * projected.plot.width, projected.plot.y + marker.y * projected.plot.height];
}

function markerNodes({ id, frame, geography, projected, markers, highlighted = new Set() }) {
  const nodes = [];
  for (const [index, marker] of markers.entries()) {
    if (!marker || typeof marker !== "object" || Array.isArray(marker)) throw new Error("Map marker must be an object");
    if (marker.size !== undefined && (!Number.isFinite(marker.size) || marker.size <= 0)) throw new Error("Map marker size must be positive and finite");
    if (marker.fraction !== undefined && (!Number.isFinite(marker.fraction) || marker.fraction < 0 || marker.fraction > 1)) throw new Error("Map marker fraction must be a number from zero to one");
    const [centerX, centerY] = markerCoordinate(marker, geography, projected);
    // A numbered pin is the deck's numbered disc, so the side list matches it.
    if (marker.number !== undefined) {
      const disc = markerSize(), pinFrame = { x: centerX - disc / 2, y: centerY - disc / 2, width: disc, height: disc };
      // On a highlighted country the disc reverses (white on navy) so it stays visible.
      const onHighlight = marker.country !== undefined && highlighted.has(geography.custom ? String(marker.country) : resolveCountryId(marker.country));
      nodes.push(...numberMarker({ id: stableId(id, "marker-base", index), role: "map-marker", labelRole: "map-marker-number", x: pinFrame.x, y: pinFrame.y, size: disc, number: marker.number, reverse: onHighlight, data: { geography: geography.id, number: marker.number } }));
      if (marker.label) {
        // The label sits on a white pill so it reads over land, sea or a filled country.
        const measured = measureText(marker.label, 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(LABEL), bold: true, wrapWidthRatio: 1 });
        const width = Math.ceil(measured.width) + 12, height = 22;
        const placeRight = pinFrame.x + disc + 4 + width <= frame.x + frame.width;
        const lx = placeRight ? pinFrame.x + disc + 4 : pinFrame.x - 4 - width;
        nodes.push(rectPrimitive({ id: stableId(id, "marker-label-pill", index), role: "map-label-pill", frame: { x: lx, y: centerY - height / 2, width, height }, style: { fill: SURFACE, stroke: token("color.rule"), lineWidth: token("line.hairline"), radius: token("radius.small") } }));
        nodes.push(textPrimitive({ id: stableId(id, "marker-label", index), role: "map-label", frame: { x: lx + 6, y: centerY - 12, width: width - 12, height: 24 }, text: marker.label, style: { fontFamily: FONT, fontSize: LABEL, color: INK, bold: true, align: "left", valign: "mid" } }));
      }
      continue;
    }
    const size = marker.size ?? 34;
    const markerFrame = { x: centerX - size / 2, y: centerY - size / 2, width: size, height: size };
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker-base", index), role: "map-marker", frame: markerFrame, style: { fill: SURFACE, stroke: INK, lineWidth: HAIRLINE, radius: token("radius.round") }, data: { geography: geography.id } }));
    const fraction = marker.fraction ?? 1;
    if (fraction >= 0.999) nodes.push(ellipsePrimitive({ id: stableId(id, "marker-fill", index), role: "map-marker-fill", frame: markerFrame, style: { fill: INK, stroke: INK, lineWidth: HAIRLINE, radius: token("radius.round") } }));
    else if (fraction > 0) nodes.push(wedgePrimitive({ id: stableId(id, "marker-fill", index), role: "map-marker-fill", frame: markerFrame, startAngle: -90, endAngle: -90 + fraction * 360, style: { fill: INK, stroke: INK, lineWidth: HAIRLINE, radius: token("radius.none") } }));
    if (marker.label) {
      const width = Math.min(150, Math.max(90, frame.width * 0.18));
      const placeRight = markerFrame.x + size + 4 + width <= frame.x + frame.width;
      const labelFrame = { x: placeRight ? markerFrame.x + size + 4 : markerFrame.x - width - 4, y: markerFrame.y - 2, width, height: size + 4 };
      nodes.push(textPrimitive({ id: stableId(id, "marker-label", index), role: "map-label", frame: labelFrame, text: marker.label, style: { fontFamily: FONT, fontSize: LABEL, color: SECONDARY, bold: true, align: placeRight ? "left" : "right", valign: "mid" } }));
    }
  }
  return nodes;
}

export function mapNodes({ id, frame, props = {} }) {
  if (props.markers !== undefined && !Array.isArray(props.markers)) throw new Error("Map markers must be an array");
  const geography = resolveGeography(props.geography ?? "world");
  if (props.choropleth) return choroplethNodes({id,frame,props,geography});
  if (props.highlightCountries !== undefined && !Array.isArray(props.highlightCountries)) throw new Error("Map highlights must be an array");
  const highlighted = new Set((props.highlightCountries || []).map(value => geography.custom ? String(value) : resolveCountryId(value)));
  const absentHighlights = [...highlighted].filter((countryId) => !geography.countries.some((country) => country.id === countryId));
  if (absentHighlights.length) throw new Error(`Highlighted countries are outside ${geography.id}: ${absentHighlights.join(", ")}`);
  const projected = projection(frame, geography.bounds);
  const nodes = geography.countries.map((country) => {
    const paths = country.polygons.map((ring) => clipRing(ring, geography.bounds)).filter((ring) => ring.length >= 3).map((ring) => ring.map(projected.project));
    return paths.length ? polygonNode({ id, country, paths, highlighted: highlighted.has(country.id) }) : null;
  }).filter(Boolean);
  nodes.push(...markerNodes({ id, frame, geography, projected, markers: props.markers || [], highlighted }));
  if (!nodes.some((node) => node.role === "map-land")) throw new Error(`Map geography ${geography.id} produced no visible land shapes`);
  return nodes;
}

function choroplethNodes({id,frame,props,geography}) {
  const spec=props.choropleth,scale=normalizeQuantitativeScale(spec.scale);
  if ((props.highlightCountries||[]).length || (props.markers||[]).length) throw new Error('Choropleth cannot combine quantitative fill with highlights or markers');
  if (!Array.isArray(spec.values)) throw new Error('Choropleth requires one value for every feature');
  const values=new Map();
  for (const item of spec.values) {
    if (!item || typeof item.featureId!=='string'||values.has(item.featureId)||!geography.countries.some(c=>c.id===item.featureId)) throw new Error('Choropleth value needs a unique known featureId');
    quantitativeScaleColor(scale,item.value);
    values.set(item.featureId,item.value);
  }
  if (values.size!==geography.countries.length) throw new Error('Choropleth requires one value for every feature; missing regions cannot be silently neutral');
  if (spec.labels?.placement!==undefined && spec.labels.placement!=='external') throw new Error('Choropleth labels support external placement');
  const fontSize=tokenValue(LABEL),gap=tokenValue(token('space.2'));
  const legendHeight=measureText('0',1000,{fontSize:tokenValue(token('type.chartLabel'))}).height+20;
  const mapFrame={...frame,y:frame.y+legendHeight+gap,height:frame.height-legendHeight-gap};
  const labelWidth=Math.min(112,frame.width*.27);
  const centerFrame={x:frame.x+labelWidth+gap,y:mapFrame.y,width:frame.width-2*(labelWidth+gap),height:mapFrame.height};
  if (centerFrame.width<80 || centerFrame.height<100) throw new Error('Choropleth frame cannot fit geography and external labels');
  const projected=projection(centerFrame,geography.bounds);
  const nodes=[],labels=[];
  for (const country of geography.countries) {
    if (!Array.isArray(country.label)||country.label.length!==2||!country.label.every(Number.isFinite)||!projected.contains(country.label)) throw new Error(`Choropleth feature ${country.id} needs a visible WGS84 labelPoint`);
    const [lon,lat]=country.label;
    const interior=country.polygons.reduce((inside,ring)=>{
      let hit=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++) if ((ring[i][1]>lat)!==(ring[j][1]>lat) && lon<(ring[j][0]-ring[i][0])*(lat-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0]) hit=!hit;
      return inside!==hit;
    },false);
    if (!interior) throw new Error(`Choropleth feature ${country.id} labelPoint must be inside its own polygon`);
    const paths=country.polygons.map(ring=>clipRing(ring,geography.bounds)).filter(ring=>ring.length>=3).map(ring=>ring.map(projected.project));
    const node=paths.length ? polygonNode({id,country,paths,highlighted:false,quantitative:{scale,value:values.get(country.id)}}) : null;
    if (!node) throw new Error(`Choropleth feature ${country.id} is not visible at this scale`);
    nodes.push(node);
    const [x,y]=projected.project(country.label),side=x<centerFrame.x+centerFrame.width/2?'left':'right';
    const measured=measureText(country.labelText ?? country.name,labelWidth,{fontSize,wrapWidthRatio:1});
    labels.push({country,x,y,side,measured});
  }
  for (const side of ['left','right']) {
    const lane=labels.filter(l=>l.side===side).sort((a,b)=>a.y-b.y);
    const required=lane.reduce((sum,l)=>sum+l.measured.height,0)+Math.max(0,lane.length-1)*gap;
    if (required>mapFrame.height) throw new Error('Choropleth external labels do not fit; enlarge map or recompose');
    let cursor=mapFrame.y;
    for (const label of lane) {label.top=Math.max(cursor,label.y-label.measured.height/2);cursor=label.top+label.measured.height+gap;}
    let bottom=mapFrame.y+mapFrame.height;
    for (const label of [...lane].reverse()) {label.top=Math.min(label.top,bottom-label.measured.height);bottom=label.top-gap;}
    for (const label of lane) {
      const x=side==='left'?frame.x:frame.x+frame.width-labelWidth;
      const edge=side==='left'?x+labelWidth:x;
      const data={featureId:label.country.id,value:values.get(label.country.id),unit:scale.unit,geography:geography.id,labelPoint:label.country.label,dependencies:[stableId(id,'land',label.country.id)]};
      const elbow=side==='left'?centerFrame.x:centerFrame.x+centerFrame.width;
      nodes.push(linePrimitive({id:stableId(id,'feature-label-leader',label.country.id,'anchor'),role:'map-label-leader',x1:label.x,y1:label.y,x2:elbow,y2:label.y,style:{stroke:SECONDARY,lineWidth:HAIRLINE},data}));
      nodes.push(linePrimitive({id:stableId(id,'feature-label-leader',label.country.id,'lane'),role:'map-label-leader',x1:elbow,y1:label.y,x2:edge,y2:label.top+label.measured.height/2,style:{stroke:SECONDARY,lineWidth:HAIRLINE},data}));
      nodes.push(textPrimitive({id:stableId(id,'feature-label',label.country.id),role:'map-label',frame:{x,y:label.top,width:labelWidth,height:label.measured.height},text:label.measured.text,style:{fontFamily:FONT,fontSize:LABEL,color:INK,align:side==='left'?'right':'left',valign:'top',lineHeight:label.measured.lineHeight,wrap:false},data:{...data,textLayout:label.measured}}));
    }
  }
  nodes.push(...quantitativeLegendNodes({id:stableId(id,'legend'),frame:{x:frame.x,y:frame.y,width:frame.width,height:legendHeight},props:{scale}}));
  return nodes;
}

export const CHOROPLETH_MAP_SAMPLE={
  geography:{id:'neutral-regions',title:'Illustrative regional areas',source:{url:'https://example.org/illustrative-regions',license:'Original synthetic fixture',sha256:'0'.repeat(64)},geojson:{type:'FeatureCollection',features:[
    {type:'Feature',id:'west',properties:{name:'Western area',labelPoint:[-2,1]},geometry:{type:'Polygon',coordinates:[[[-4,0],[0,0],[0,3],[-4,3],[-4,0]]]}},
    {type:'Feature',id:'east',properties:{name:'Eastern area',labelPoint:[2,1]},geometry:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,3],[0,3],[0,0]]]}}
  ]}},choropleth:{values:[{featureId:'west',value:-2},{featureId:'east',value:8}],scale:{domain:[-2,8],unit:'%',palette:'red-white-green'},labels:{placement:'external'}}
};

export const CUSTOM_MAP_SAMPLE = {
  id: "germany-import", title: "Germany imported geometry",
  source: { ...NATURAL_EARTH_SOURCE, license: "Public domain" },
  geojson: { type: "FeatureCollection", features: [{ type: "Feature", id: "DEU", properties: { name: "Germany" }, geometry: { type: "Polygon", coordinates: COUNTRY_BY_ID.get("DEU").polygons.map(ring => [...ring, ring[0]]) } }] }
};
