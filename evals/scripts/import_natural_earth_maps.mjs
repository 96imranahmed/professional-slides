import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = path.join(repositoryRoot, "skills/professional-slides/runtime/natural-earth-map-data.mjs");

export const SOURCE = Object.freeze({
  name: "Natural Earth Admin 0 Countries",
  scale: "1:110m",
  version: "5.1.1",
  commit: "ca96624a56bd078437bca8184e78163e5039ad19",
  url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_110m_admin_0_countries.geojson",
  sha256: "6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f",
  terms: "https://www.naturalearthdata.com/about/terms-of-use/"
});

export const SUPPLEMENT_SOURCE = Object.freeze({
  name: "Natural Earth Admin 0 Countries supplement",
  scale: "1:50m",
  version: "5.1.1",
  commit: SOURCE.commit,
  url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_admin_0_countries.geojson",
  sha256: "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb",
  includes: Object.freeze(["BHR"]),
  rationale: "Bahrain is a GCC member omitted by the schematic 1:110m country set."
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function rounded(value) {
  return Number(Number(value).toFixed(4));
}

function cleanRing(ring) {
  const points = [];
  for (const coordinate of ring) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) throw new Error("Natural Earth ring contains an invalid coordinate");
    const point = [rounded(coordinate[0]), rounded(coordinate[1])];
    const prior = points.at(-1);
    if (!prior || prior[0] !== point[0] || prior[1] !== point[1]) points.push(point);
  }
  if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
  return points.length >= 3 ? points : [];
}

function allRings(geometry) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) throw new Error(`Unsupported Natural Earth geometry: ${geometry?.type}`);
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map(cleanRing)).filter((ring) => ring.length >= 3);
}

function featureRecord(feature) {
  const properties = feature.properties || {};
  const id = String(properties.ADM0_A3 || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(id)) throw new Error(`Natural Earth feature has an invalid ADM0_A3 id: ${id}`);
  const label = [Number(properties.LABEL_X), Number(properties.LABEL_Y)];
  return {
    id,
    name: String(properties.ADMIN || properties.NAME || id),
    continent: String(properties.CONTINENT || ""),
    region: String(properties.REGION_UN || ""),
    subregion: String(properties.SUBREGION || ""),
    label: label.every(Number.isFinite) ? label.map(rounded) : null,
    polygons: allRings(feature.geometry)
  };
}

async function sourceBytes(source, flag) {
  const fileFlag = process.argv.indexOf(flag);
  if (fileFlag >= 0) {
    const sourceFile = process.argv[fileFlag + 1];
    if (!sourceFile) throw new Error(`${flag} requires a path`);
    return fs.readFile(path.resolve(sourceFile));
  }
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

const bytes = await sourceBytes(SOURCE, "--source-file");
const observedHash = sha256(bytes);
if (observedHash !== SOURCE.sha256) throw new Error(`Natural Earth source hash changed: ${observedHash}`);
const geojson = JSON.parse(bytes.toString("utf8"));
if (geojson.type !== "FeatureCollection" || geojson.features?.length !== 177) throw new Error("Natural Earth 1:110m country collection has unexpected coverage");
const supplementBytes = await sourceBytes(SUPPLEMENT_SOURCE, "--supplement-file");
const observedSupplementHash = sha256(supplementBytes);
if (observedSupplementHash !== SUPPLEMENT_SOURCE.sha256) throw new Error(`Natural Earth supplement hash changed: ${observedSupplementHash}`);
const supplementGeojson = JSON.parse(supplementBytes.toString("utf8"));
if (supplementGeojson.type !== "FeatureCollection" || !Array.isArray(supplementGeojson.features)) throw new Error("Natural Earth 1:50m supplement has unexpected coverage");
const supplements = SUPPLEMENT_SOURCE.includes.map((id) => {
  const feature = supplementGeojson.features.find(candidate => String(candidate.properties?.ADM0_A3 || "").trim().toUpperCase() === id);
  if (!feature) throw new Error(`Natural Earth supplement is missing ${id}`);
  return featureRecord(feature);
});
const countries = [...geojson.features.map(featureRecord), ...supplements].sort((left, right) => left.id.localeCompare(right.id));
if (new Set(countries.map((country) => country.id)).size !== countries.length) throw new Error("Natural Earth country ids are not unique");

const source = `// Generated by evals/scripts/import_natural_earth_maps.mjs. Do not edit by hand.\n`+
  `// Natural Earth is public-domain map data. See NATURAL_EARTH_SOURCE.\n`+
  `export const NATURAL_EARTH_SOURCE = Object.freeze(${JSON.stringify({ ...SOURCE, supplements: [SUPPLEMENT_SOURCE] }, null, 2)});\n\n`+
  `export const NATURAL_EARTH_COUNTRIES = Object.freeze(${JSON.stringify(countries)});\n`;
await fs.writeFile(outputPath, source, "utf8");
console.log(JSON.stringify({ accepted: true, output: outputPath, countries: countries.length, sha256: observedHash, supplementSha256: observedSupplementHash }, null, 2));
