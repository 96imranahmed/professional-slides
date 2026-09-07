import {
  ellipsePrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { NATURAL_EARTH_COUNTRIES, NATURAL_EARTH_SOURCE } from "./natural-earth-map-data.mjs";

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
  "color.surface",
  "color.surfaceMuted",
  "color.ink",
  "color.textSecondary",
  "color.componentPrimary",
  "font.body",
  "type.label",
  "line.hairline",
  "radius.round",
  "radius.none"
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

function polygonNode({ id, country, paths, highlighted }) {
  const points = paths.flat();
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys), width = Math.max(...xs) - x, height = Math.max(...ys) - y;
  if (width < 0.35 || height < 0.35) return null;
  const normalized = paths.map((path) => path.map(([px, py]) => [Number(((px - x) / width).toFixed(6)), Number(((py - y) / height).toFixed(6))]));
  const fill = highlighted ? PRIMARY : MUTED_SURFACE;
  return shapePrimitive({
    id: stableId(id, "land", country.id),
    role: "map-land",
    geometry: "customPolygon",
    frame: { x, y, width, height },
    style: { fill, stroke: SURFACE, lineWidth: HAIRLINE, radius: token("radius.none") },
    data: {
      paths: normalized,
      countryId: country.id,
      countryName: country.name,
      highlighted,
      source: NATURAL_EARTH_SOURCE.name,
      sourceUrl: NATURAL_EARTH_SOURCE.url,
      sourceCommit: NATURAL_EARTH_SOURCE.commit
    }
  });
}

function markerCoordinate(marker, geography, projected) {
  if (marker.country) {
    const id = resolveCountryId(marker.country);
    const country = geography.countries.find((candidate) => candidate.id === id);
    if (!country) throw new Error(`Map marker country ${id} is outside ${geography.id}`);
    if (!country.label || !projected.contains(country.label)) throw new Error(`Map marker country ${id} has no visible label point`);
    return projected.project(country.label);
  }
  if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y) || marker.x < 0 || marker.x > 1 || marker.y < 0 || marker.y > 1) throw new Error("Map markers require a country or unit x and y coordinates");
  return [projected.plot.x + marker.x * projected.plot.width, projected.plot.y + marker.y * projected.plot.height];
}

function markerNodes({ id, frame, geography, projected, markers }) {
  const nodes = [];
  for (const [index, marker] of markers.entries()) {
    if (!marker || typeof marker !== "object" || Array.isArray(marker)) throw new Error("Map marker must be an object");
    if (marker.size !== undefined && (!Number.isFinite(marker.size) || marker.size <= 0)) throw new Error("Map marker size must be positive and finite");
    if (marker.fraction !== undefined && (!Number.isFinite(marker.fraction) || marker.fraction < 0 || marker.fraction > 1)) throw new Error("Map marker fraction must be a number from zero to one");
    const [centerX, centerY] = markerCoordinate(marker, geography, projected);
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
  const highlighted = new Set((props.highlightCountries || []).map(resolveCountryId));
  const absentHighlights = [...highlighted].filter((countryId) => !geography.countries.some((country) => country.id === countryId));
  if (absentHighlights.length) throw new Error(`Highlighted countries are outside ${geography.id}: ${absentHighlights.join(", ")}`);
  const projected = projection(frame, geography.bounds);
  const nodes = geography.countries.map((country) => {
    const paths = country.polygons.map((ring) => clipRing(ring, geography.bounds)).filter((ring) => ring.length >= 3).map((ring) => ring.map(projected.project));
    return paths.length ? polygonNode({ id, country, paths, highlighted: highlighted.has(country.id) }) : null;
  }).filter(Boolean);
  nodes.push(...markerNodes({ id, frame, geography, projected, markers: props.markers || [] }));
  if (!nodes.some((node) => node.role === "map-land")) throw new Error(`Map geography ${geography.id} produced no visible land shapes`);
  return nodes;
}
